import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { FeatureDisabledException } from './feature-disabled.exception';
import { FEATURE_FLAG_KEY } from './require-feature-flag.decorator';
import { FeatureFlagName } from './feature-flag.types';
import { FeatureFlagService } from './feature-flag.service';

type GatewayRequest = Request & { user?: { id?: string } };

const CUSTOMER_FEATURE_PATH_FLAGS: ReadonlyArray<readonly [string, FeatureFlagName]> = [
  ['/money-requests', 'request-money'],
  ['/splits', 'bill-splitting'],
  ['/split-allocations', 'bill-splitting'],
  ['/offers', 'offers-rewards'],
  ['/recharges', 'recharge-bill-payments'],
  ['/bill-payments', 'recharge-bill-payments'],
  ['/billers', 'recharge-bill-payments'],
  ['/bills', 'recharge-bill-payments'],
  ['/saved-billers', 'recharge-bill-payments'],
  ['/bill-reminders', 'recharge-bill-payments'],
  ['/mandates', 'autopay-mandates'],
];

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GatewayRequest>();
    const flagName = this.reflector.getAllAndOverride<FeatureFlagName>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? this.flagForCustomerFeaturePath(request.path);

    if (!flagName) return true;

    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user identity is required');
    }

    if (!(await this.featureFlags.evaluate(flagName, userId)).enabled) {
      throw new FeatureDisabledException();
    }

    return true;
  }

  private flagForCustomerFeaturePath(path: string): FeatureFlagName | null {
    const marker = '/customer-features';
    const index = path.indexOf(marker);
    const suffix = index >= 0 ? path.slice(index + marker.length) : path;

    for (const [prefix, flagName] of CUSTOMER_FEATURE_PATH_FLAGS) {
      if (suffix === prefix || suffix.startsWith(`${prefix}/`)) return flagName;
    }

    return null;
  }
}
