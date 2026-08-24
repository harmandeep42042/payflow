import { beginLatestRequest, isLatestRequest, type RequestRef } from './request-sequencing';

describe.each(['wallet', 'transaction', 'recipient'])('%s request sequencing', () => {
  it('aborts the old request and prevents its stale response from committing', () => {
    const ref: RequestRef = { current: null };
    const oldRequest = beginLatestRequest(ref);
    const newRequest = beginLatestRequest(ref);

    expect(oldRequest.controller.signal.aborted).toBe(true);
    expect(isLatestRequest(ref, oldRequest)).toBe(false);
    expect(isLatestRequest(ref, newRequest)).toBe(true);
  });
});
