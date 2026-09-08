import * as fs from 'fs';
import * as path from 'path';

const rewardSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/components/RewardedAdButton.tsx'),
  'utf8',
);

const offerSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/offers/page.tsx'),
  'utf8',
);

describe('Offer and reward duplicate-submit safety', () => {
  it('guards reward completion synchronously', () => {
    expect(rewardSource).toContain(
      'if (rewardMutationLockRef.current) return;',
    );
    expect(rewardSource).toContain(
      'rewardMutationLockRef.current = true;',
    );
    expect(rewardSource).toContain(
      'rewardMutationLockRef.current = false;',
    );
  });

  it('disables the reward trigger while processing', () => {
    expect(rewardSource).toContain('disabled={processing}');
    expect(rewardSource).toContain('aria-busy={processing}');
  });

  it('guards Offer claim synchronously', () => {
    expect(offerSource).toContain(
      'if (claimMutationLockRef.current) return;',
    );
    expect(offerSource).toContain(
      'claimMutationLockRef.current = true;',
    );
    expect(offerSource).toContain(
      'claimMutationLockRef.current = false;',
    );
  });

  it('tracks Offer claim pending state through finally', () => {
    expect(offerSource).toContain('setClaimPending(true);');
    expect(offerSource).toContain('setClaimPending(false);');
    expect(offerSource).toContain('finally {');
  });

  it('preserves eligibility and disables pending claims', () => {
    expect(offerSource).toContain(
      'disabled={claimPending || !selected.eligible}',
    );
    expect(offerSource).toContain(
      'aria-busy={claimPending}',
    );
    expect(offerSource).toContain(
      'onClick={() => void claim(selected)}',
    );
  });

  it('retains authenticated request boundaries', () => {
    expect(rewardSource).toContain('userAuthenticatedRequest');
    expect(offerSource).toContain('userAuthenticatedRequest');
  });

  it('contains no direct frontend wallet or ledger execution', () => {
    const combined = rewardSource + '\n' + offerSource;

    for (const marker of [
      'transferWallet',
      'creditWallet',
      'debitWallet',
      'ledgerEntry',
      'executePayment',
      'wallet.update',
      'transaction.create',
    ]) {
      expect(combined).not.toContain(marker);
    }
  });
});