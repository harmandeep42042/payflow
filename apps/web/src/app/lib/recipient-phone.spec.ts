import {
  getRecipientPhoneShortcut,
  normalizeRecipientPhone,
} from './recipient-phone';

describe('normalizeRecipientPhone', () => {
  it('normalizes an international formatted phone number', () => {
    expect(
      normalizeRecipientPhone('+91 98765 43210'),
    ).toBe('+919876543210');
  });

  it('accepts a plain valid mobile number', () => {
    expect(
      normalizeRecipientPhone('9876543210'),
    ).toBe('9876543210');
  });

  it('does not classify a VPA as a phone number', () => {
    expect(
      normalizeRecipientPhone('friend@payflow'),
    ).toBeNull();
  });

  it('rejects a short invalid identifier', () => {
    expect(
      normalizeRecipientPhone('1234'),
    ).toBeNull();
  });
});
describe('getRecipientPhoneShortcut', () => {
  it('reads and normalizes a phone quick-pay deep link', () => {
    const params = new URLSearchParams(
      'phone=%2B91%2098765%2043210',
    );

    expect(
      getRecipientPhoneShortcut(params),
    ).toBe('+919876543210');
  });

  it('returns null for an invalid phone shortcut', () => {
    const params = new URLSearchParams(
      'phone=1234',
    );

    expect(
      getRecipientPhoneShortcut(params),
    ).toBeNull();
  });

  it('does not activate phone shortcuts during QR mode', () => {
    const params = new URLSearchParams(
      'qr=1&phone=9876543210',
    );

    expect(
      getRecipientPhoneShortcut(params),
    ).toBeNull();
  });
});
