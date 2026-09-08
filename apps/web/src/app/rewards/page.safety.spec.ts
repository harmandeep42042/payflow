import * as fs from 'fs';
import * as path from 'path';

const rewardsPagePath = path.join(
  process.cwd(),
  'src/app/rewards/page.tsx',
);

const rewardedAdButtonPath = path.join(
  process.cwd(),
  'src/app/components/RewardedAdButton.tsx',
);

const pageSource = fs.readFileSync(rewardsPagePath, 'utf8');
const buttonSource = fs.readFileSync(rewardedAdButtonPath, 'utf8');
const combinedSource = `${pageSource}\n${buttonSource}`;

describe('customer rewards safety contract', () => {
  it('keeps the dedicated rewards page connected to the existing rewarded action', () => {
    expect(pageSource).toContain('RewardedAdButton');
    expect(pageSource).toMatch(/<RewardedAdButton\s*\/>/);
  });

  it('keeps customer eligibility and Payflow-limit disclosure visible', () => {
    expect(pageSource).toContain('eligible activities');
    expect(buttonSource).toContain(
      'Demo rewards are subject to Payflow limits',
    );
  });

  it('uses the authenticated customer request boundary', () => {
    expect(buttonSource).toContain('userAuthenticatedRequest');

    expect(buttonSource).not.toMatch(
      /localStorage\.getItem\(\s*['"]userId['"]\s*\)/,
    );

    expect(buttonSource).not.toMatch(
      /sessionStorage\.getItem\(\s*['"]userId['"]\s*\)/,
    );
  });

  it('does not perform direct wallet, ledger, or payment execution in the rewards UI', () => {
    const forbidden = [
      'transferWallet',
      'debitWallet',
      'creditWallet',
      'ledgerEntry',
      'executePayment',
      'wallet.update',
      'wallet.updateMany',
      'transaction.create',
    ];

    for (const marker of forbidden) {
      expect(combinedSource).not.toContain(marker);
    }
  });

  it('does not turn the rewards page itself into a cashback funding engine', () => {
    expect(pageSource).not.toContain('creditWallet');
    expect(pageSource).not.toContain('wallet.update');
    expect(pageSource).not.toContain('ledgerEntry');
    expect(pageSource).not.toContain('transferWallet');
  });

  it('keeps reward execution behind the existing component instead of duplicating an API flow in the page', () => {
    expect(pageSource).not.toContain('userAuthenticatedRequest');
    expect(pageSource).not.toMatch(/\bfetch\s*\(/);
  });
});