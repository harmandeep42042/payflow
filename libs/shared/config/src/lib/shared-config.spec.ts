import {
  payflowConfig,
} from './shared-config';

describe('shared-config', () => {
  it('provides default local ports', () => {
    expect(
      payflowConfig.ports.apiGateway,
    ).toBe(4000);

    expect(
      payflowConfig.ports.walletService,
    ).toBe(4001);

    expect(
      payflowConfig.ports.authService,
    ).toBe(4002);
  });

  it('provides local service URLs', () => {
    expect(
      payflowConfig.urls.apiGateway,
    ).toContain('4000');

    expect(
      payflowConfig.urls.walletService,
    ).toContain('4001');

    expect(
      payflowConfig.urls.authService,
    ).toContain('4002');
  });
});