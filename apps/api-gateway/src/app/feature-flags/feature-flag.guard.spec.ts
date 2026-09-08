import { UnauthorizedException } from '@nestjs/common';
import { FeatureDisabledException } from './feature-disabled.exception';
import { FeatureFlagGuard } from './feature-flag.guard';
import { FeatureFlagService } from './feature-flag.service';

describe('FeatureFlagGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const featureFlags = { evaluate: jest.fn() } as unknown as FeatureFlagService;
  const guard = new FeatureFlagGuard(reflector as never, featureFlags);

  beforeEach(() => jest.clearAllMocks());

  function context(path: string, user?: { id?: string }) {
    return {
      switchToHttp: () => ({ getRequest: () => ({ path, user }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as never;
  }

  it('does not bypass authentication when a flagged route has no user', async () => {
    reflector.getAllAndOverride.mockReturnValue('offers-rewards');

    await expect(guard.canActivate(context('/rewards'))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(featureFlags.evaluate).not.toHaveBeenCalled();
  });

  it('uses the established safe feature-disabled response contract', async () => {
    reflector.getAllAndOverride.mockReturnValue('offers-rewards');
    (featureFlags.evaluate as jest.Mock).mockResolvedValue({ enabled: false });

    await expect(guard.canActivate(context('/rewards', { id: 'user-1' }))).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FEATURE_DISABLED' }),
    });
  });

  it('maps only optional customer-feature paths and allows unrelated paths', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    (featureFlags.evaluate as jest.Mock).mockResolvedValue({ enabled: true });

    await expect(guard.canActivate(context('/api/v1/customer-features/mandates', { id: 'user-1' }))).resolves.toBe(true);
    expect(featureFlags.evaluate).toHaveBeenCalledWith('autopay-mandates', 'user-1');

    await expect(guard.canActivate(context('/api/v1/customer-features/admin/offers', { id: 'user-1' }))).resolves.toBe(true);
    expect(featureFlags.evaluate).toHaveBeenCalledTimes(1);
  });

  it('throws the feature-specific exception when the optional path is disabled', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    (featureFlags.evaluate as jest.Mock).mockResolvedValue({ enabled: false });

    await expect(guard.canActivate(context('/customer-features/splits', { id: 'user-1' }))).rejects.toBeInstanceOf(FeatureDisabledException);
  });
});
