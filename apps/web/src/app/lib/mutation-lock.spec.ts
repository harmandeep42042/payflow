import { acquireMutationLock, releaseMutationLock, type MutationLock } from './mutation-lock';

describe.each(['deposit', 'withdrawal', 'transfer', 'send money'])('%s mutation lock', (operation) => {
  let lock: MutationLock;

  beforeEach(() => { lock = { current: false }; });

  it(`rejects a rapid second ${operation} mutation`, () => {
    expect(acquireMutationLock(lock)).toBe(true);
    expect(acquireMutationLock(lock)).toBe(false);
  });

  it('releases after success', async () => {
    expect(acquireMutationLock(lock)).toBe(true);
    try { await Promise.resolve(); } finally { releaseMutationLock(lock); }
    expect(acquireMutationLock(lock)).toBe(true);
  });

  it('releases after failure', async () => {
    expect(acquireMutationLock(lock)).toBe(true);
    try { await Promise.reject(new Error('failed')); } catch { /* expected */ } finally { releaseMutationLock(lock); }
    expect(acquireMutationLock(lock)).toBe(true);
  });
});
