import { customerCapabilities } from './customer-capabilities';

describe('customer capability roadmap', () => {
  it('links implemented capabilities and permits provider-status/history pages without claiming provider execution', () => {
    for (const capability of customerCapabilities) {
      if (capability.status === 'IMPLEMENTED') expect(capability.href).toBeTruthy();
      if (['BACKEND REQUIRED', 'NOT SAFE TO IMPLEMENT YET'].includes(capability.status)) {
        expect(capability.href).toBeUndefined();
      }
    }
  });

  it('classifies every remaining roadmap capability explicitly', () => {
    expect(customerCapabilities.map((item) => item.name)).toEqual(expect.arrayContaining([
      'Contacts and favourites', 'Request money', 'Split bill', 'Mobile recharge', 'Bill payments',
      'AutoPay', 'Help and disputes', 'Spending insights',
    ]));
  });
});
