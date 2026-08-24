import { buildRecipientGatewayRequest } from './recipient-request';

describe('recipient request security', () => {
  it('blocks unauthenticated requests', () => {
    expect(buildRecipientGatewayRequest(new URL('http://localhost?email=user@example.test'), null)).toBeNull();
  });
  it('targets the guarded Gateway route and forwards authorization', () => {
    expect(buildRecipientGatewayRequest(new URL('http://localhost?vpa=user%40payflow&currency=usd&excludeUserId=u2'), 'Bearer access')).toEqual({
      path: '/wallets/wallet-recipients/resolve?vpa=user%40payflow&currency=USD&excludeUserId=u2', authorization: 'Bearer access',
    });
  });
});
