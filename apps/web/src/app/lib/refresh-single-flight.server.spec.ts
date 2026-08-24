import { resetRefreshFlightsForTests, singleFlightRefresh } from './refresh-single-flight.server';

describe('customer server refresh single-flight', () => {
  beforeEach(resetRefreshFlightsForTests);

  it('coalesces concurrent tabs using the same refresh token', async () => {
    let resolve!: (value: string) => void;
    const operation = jest.fn(() => new Promise<string>((done) => { resolve = done; }));

    const first = singleFlightRefresh('shared-refresh-token', operation);
    const second = singleFlightRefresh('shared-refresh-token', operation);
    resolve('rotated-session');

    await expect(Promise.all([first, second])).resolves.toEqual(['rotated-session', 'rotated-session']);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('shares a failed refresh instead of starting a retry storm', async () => {
    const failure = new Error('revoked');
    const operation = jest.fn().mockRejectedValue(failure);

    const first = singleFlightRefresh('revoked-token', operation);
    const second = singleFlightRefresh('revoked-token', operation);

    await expect(first).rejects.toBe(failure);
    await expect(second).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
