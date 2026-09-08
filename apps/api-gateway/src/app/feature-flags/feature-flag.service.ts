import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'crypto';
import { createClient, RedisClientType } from 'redis';
import {
  FEATURE_FLAG_NAMES,
  FeatureFlagConfiguration,
  FeatureFlagEvaluation,
  FeatureFlagName,
} from './feature-flag.types';
import { MetricsService } from '../observability/metrics.service';

const MAX_SUBJECT_ID_LENGTH = 128;
const MAX_LIST_ENTRIES = 1_000;
const MAX_ROLLOUT_SALT_LENGTH = 64;

const DEFAULT_FLAGS: Record<FeatureFlagName, FeatureFlagConfiguration> = {
  'offers-rewards': {
    enabled: true,
    rolloutPercentage: 100,
    rolloutSalt: 'v1',
    allowlist: [],
    denylist: [],
  },
  'recharge-bill-payments': {
    enabled: true,
    rolloutPercentage: 100,
    rolloutSalt: 'v1',
    allowlist: [],
    denylist: [],
  },
  'autopay-mandates': {
    enabled: true,
    rolloutPercentage: 100,
    rolloutSalt: 'v1',
    allowlist: [],
    denylist: [],
  },
  'bill-splitting': {
    enabled: true,
    rolloutPercentage: 100,
    rolloutSalt: 'v1',
    allowlist: [],
    denylist: [],
  },
  'request-money': {
    enabled: true,
    rolloutPercentage: 100,
    rolloutSalt: 'v1',
    allowlist: [],
    denylist: [],
  },
};

@Injectable()
export class FeatureFlagService implements OnModuleDestroy {
  private readonly logger = new Logger(FeatureFlagService.name);
  private client: RedisClientType | null = null;
  private connectPromise: Promise<RedisClientType> | null = null;

  constructor(private readonly metrics: MetricsService) {}

  async evaluate(
    flagName: string,
    stableSubjectId: string,
  ): Promise<FeatureFlagEvaluation> {
    const flag = this.toRegisteredFlagName(flagName);
    const subjectId = this.normalizeSubjectId(stableSubjectId);

    if (!flag || !subjectId) {
      this.metrics.recordFeatureFlagEvaluation('unknown', 'disabled', 'default');
      return { enabled: false, source: 'default' };
    }

    const configuration = await this.getConfiguration(flag);
    const enabled = this.isEnabled(flag, subjectId, configuration.value);

    this.metrics.recordFeatureFlagEvaluation(
      flag,
      enabled ? 'enabled' : 'disabled',
      configuration.source,
    );

    return { enabled, source: configuration.source };
  }

  private async getConfiguration(flagName: FeatureFlagName): Promise<{
    value: FeatureFlagConfiguration;
    source: 'redis' | 'default';
  }> {
    try {
      const raw = await (await this.getClient()).get(this.redisKey(flagName));

      if (typeof raw !== 'string') {
        return { value: DEFAULT_FLAGS[flagName], source: 'default' };
      }

      const parsed = this.parseConfiguration(raw);

      if (parsed) {
        return { value: parsed, source: 'redis' };
      }

      this.logger.warn({ event: 'feature_flag_invalid_configuration', flagName });
    } catch {
      this.logger.warn({ event: 'feature_flag_redis_unavailable', flagName });
    }

    // Static, versioned defaults preserve the frozen release behavior when
    // the dynamic control plane is unavailable. They are not mutable state.
    return { value: DEFAULT_FLAGS[flagName], source: 'default' };
  }

  private isEnabled(
    flagName: FeatureFlagName,
    subjectId: string,
    configuration: FeatureFlagConfiguration,
  ): boolean {
    if (configuration.denylist.includes(subjectId)) return false;
    if (!configuration.enabled) return false;
    if (configuration.allowlist.includes(subjectId)) return true;
    if (configuration.rolloutPercentage === 100) return true;
    if (configuration.rolloutPercentage === 0) return false;

    return this.bucket(flagName, subjectId, configuration.rolloutSalt) <
      configuration.rolloutPercentage;
  }

  private bucket(
    flagName: FeatureFlagName,
    subjectId: string,
    rolloutSalt: string,
  ): number {
    const digest = createHash('sha256')
      .update(`${flagName}:${subjectId}:${rolloutSalt}`, 'utf8')
      .digest();

    return digest.readUInt32BE(0) % 100;
  }

  private parseConfiguration(raw: string): FeatureFlagConfiguration | null {
    try {
      const value: unknown = JSON.parse(raw);

      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

      const config = value as Record<string, unknown>;
      const enabled = config['enabled'];
      const rolloutPercentage = config['rolloutPercentage'];
      const rolloutSalt = config['rolloutSalt'];
      const allowlist = this.parseSubjectList(config['allowlist']);
      const denylist = this.parseSubjectList(config['denylist']);

      if (
        typeof enabled !== 'boolean' ||
        typeof rolloutPercentage !== 'number' ||
        !Number.isInteger(rolloutPercentage) ||
        rolloutPercentage < 0 ||
        rolloutPercentage > 100 ||
        typeof rolloutSalt !== 'string' ||
        rolloutSalt.length < 1 ||
        rolloutSalt.length > MAX_ROLLOUT_SALT_LENGTH ||
        !/^[A-Za-z0-9._-]+$/.test(rolloutSalt) ||
        !allowlist ||
        !denylist
      ) {
        return null;
      }

      return { enabled, rolloutPercentage, rolloutSalt, allowlist, denylist };
    } catch {
      return null;
    }
  }

  private parseSubjectList(value: unknown): string[] | null {
    if (!Array.isArray(value) || value.length > MAX_LIST_ENTRIES) return null;
    const normalized = value.map((item) =>
      typeof item === 'string' ? item.trim() : '',
    );

    return normalized.every((item) => this.normalizeSubjectId(item) === item)
      ? normalized
      : null;
  }

  private normalizeSubjectId(value: string): string | null {
    const normalized = value?.trim();
    return normalized && normalized.length <= MAX_SUBJECT_ID_LENGTH
      ? normalized
      : null;
  }

  private toRegisteredFlagName(value: string): FeatureFlagName | null {
    return FEATURE_FLAG_NAMES.includes(value as FeatureFlagName)
      ? (value as FeatureFlagName)
      : null;
  }

  private redisKey(flagName: FeatureFlagName): string {
    return `payflow:feature-flags:v1:${flagName}`;
  }

  private async getClient(): Promise<RedisClientType> {
    if (this.client?.isReady) return this.client;
    if (this.connectPromise) return this.connectPromise;

    const redisUrl = process.env['REDIS_URL'];
    if (!redisUrl) throw new Error('REDIS_URL is not configured');

    const client = createClient({ url: redisUrl });
    client.on('error', () => {
      this.logger.warn({ event: 'feature_flag_redis_client_error' });
    });

    this.connectPromise = (async () => {
      try {
        await client.connect();
        this.client = client;
        return client;
      } catch (error) {
        if (client.isOpen) await client.disconnect();
        throw error;
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.quit();
    this.client = null;
    this.connectPromise = null;
  }
}
