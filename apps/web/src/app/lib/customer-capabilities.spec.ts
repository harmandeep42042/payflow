import { customerCapabilities } from './customer-capabilities';

describe('customer capability roadmap', () => {
  it('links implemented capabilities and never links unsupported actions', () => {
    for (const capability of customerCapabilities) {
      if (capability.status === 'IMPLEMENTED') expect(capability.href).toBeTruthy();
      if (['BACKEND REQUIRED', 'EXTERNAL PROVIDER REQUIRED', 'NOT SAFE TO IMPLEMENT YET'].includes(capability.status)) {
        expect(capability.href).toBeUndefined();
      }
    }
  });

  it('classifies every remaining roadmap capability explicitly', () => {
    expect(customerCapabilities.map((item) => item.name)).toEqual(expect.arrayContaining([
      'Contacts', 'Request money', 'Split bill', 'Recharge and bill payments',
      'AutoPay', 'Help and disputes', 'Spending insights',
    ]));
  });
});
