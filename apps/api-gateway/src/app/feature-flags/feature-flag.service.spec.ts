import { createClient } from 'redis';
import { MetricsService } from '../observability/metrics.service';
import { FeatureFlagService } from './feature-flag.service';

jest.mock('redis', () => ({ createClient: jest.fn() }));

const config = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    enabled: true,
    rolloutPercentage: 50,
    rolloutSalt: 'rollout-v1',
    allowlist: [],
    denylist: [],
    ...overrides,
  });

describe('FeatureFlagService', () => {
  const metrics = {
    recordFeatureFlagEvaluation: jest.fn(),
  } as unknown as MetricsService;
  const mockedCreateClient = createClient as jest.Mock;
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REDIS_URL = 'redis://feature-flags.test:6379';
  });

  afterAll(() => {
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
  });

  function useRedisValue(value: string | null): void {
    mockedCreateClient.mockReturnValue({
      isReady: false,
      isOpen: false,
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(value),
      quit: jest.fn(),
    });
  }

  it('blocks a globally disabled flag', async () => {
    useRedisValue(config({ enabled: false, allowlist: ['user-1'] }));
    const service = new FeatureFlagService(metrics);

    await expect(service.evaluate('offers-rewards', 'user-1')).resolves.toMatchObject({ enabled: false, source: 'redis' });
  });

  it('allows an enabled 100 percent rollout', async () => {
    useRedisValue(config({ rolloutPercentage: 100 }));
    const service = new FeatureFlagService(metrics);

    await expect(service.evaluate('offers-rewards', 'user-1')).resolves.toMatchObject({ enabled: true });
  });

  it('blocks zero percent rollout unless the user is allowlisted', async () => {
    useRedisValue(config({ rolloutPercentage: 0, allowlist: ['allowed-user'] }));
    const service = new FeatureFlagService(metrics);

    await expect(service.evaluate('offers-rewards', 'other-user')).resolves.toMatchObject({ enabled: false });
    await expect(service.evaluate('offers-rewards', 'allowed-user')).resolves.toMatchObject({ enabled: true });
  });

  it('lets the denylist override the allowlist', async () => {
    useRedisValue(config({ rolloutPercentage: 100, allowlist: ['user-1'], denylist: ['user-1'] }));
    const service = new FeatureFlagService(metrics);

    await expect(service.evaluate('offers-rewards', 'user-1')).resolves.toMatchObject({ enabled: false });
  });

  it('is deterministic across calls and service instances', async () => {
    useRedisValue(config({ rolloutPercentage: 37 }));
    const first = new FeatureFlagService(metrics);
    const second = new FeatureFlagService(metrics);

    const firstResult = await first.evaluate('bill-splitting', 'stable-user');
    const repeatedResult = await first.evaluate('bill-splitting', 'stable-user');
    const secondResult = await second.evaluate('bill-splitting', 'stable-user');

    expect(repeatedResult.enabled).toBe(firstResult.enabled);
    expect(secondResult.enabled).toBe(firstResult.enabled);
  });

  it('does not use Math.random for percentage assignment', async () => {
    useRedisValue(config({ rolloutPercentage: 37 }));
    const random = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('rollout must not call Math.random');
    });
    const service = new FeatureFlagService(metrics);

    await expect(service.evaluate('bill-splitting', 'stable-user')).resolves.toEqual(
      expect.objectContaining({ source: 'redis' }),
    );
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it('falls back safely to the enabled immutable default for malformed Redis configuration', async () => {
    useRedisValue('{not-json');
    const service = new FeatureFlagService(metrics);

    await expect(service.evaluate('offers-rewards', 'user-1')).resolves.toEqual({ enabled: true, source: 'default' });
  });

  it('falls back to the explicit default when Redis is unavailable', async () => {
    delete process.env.REDIS_URL;
    const service = new FeatureFlagService(metrics);

    await expect(service.evaluate('offers-rewards', 'user-1')).resolves.toEqual({ enabled: true, source: 'default' });
  });

  it('disables unknown flags deterministically', async () => {
    const service = new FeatureFlagService(metrics);

    await expect(service.evaluate('not-registered', 'user-1')).resolves.toEqual({ enabled: false, source: 'default' });
  });
});
