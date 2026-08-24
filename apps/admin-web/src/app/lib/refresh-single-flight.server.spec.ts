import { resetRefreshFlightsForTests, singleFlightRefresh } from './refresh-single-flight.server';

describe('admin server refresh single-flight', () => {
  beforeEach(resetRefreshFlightsForTests);

  it('coalesces concurrent tabs using the same refresh token', async () => {
    const operation = jest.fn().mockResolvedValue('rotated-admin-session');

    await expect(Promise.all([
      singleFlightRefresh('shared-admin-token', operation),
      singleFlightRefresh('shared-admin-token', operation),
    ])).resolves.toEqual(['rotated-admin-session', 'rotated-admin-session']);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
