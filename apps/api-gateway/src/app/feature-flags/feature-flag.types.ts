export const FEATURE_FLAG_NAMES = [
  'offers-rewards',
  'recharge-bill-payments',
  'autopay-mandates',
  'bill-splitting',
  'request-money',
] as const;

export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];

export type FeatureFlagConfiguration = {
  enabled: boolean;
  rolloutPercentage: number;
  rolloutSalt: string;
  allowlist: string[];
  denylist: string[];
};

export type FeatureFlagEvaluation = {
  enabled: boolean;
  source: 'redis' | 'default';
};
