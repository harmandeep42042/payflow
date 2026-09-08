import { SetMetadata } from '@nestjs/common';
import { FeatureFlagName } from './feature-flag.types';

export const FEATURE_FLAG_KEY = 'payflow:feature-flag';

export const RequireFeatureFlag = (flagName: FeatureFlagName) =>
  SetMetadata(FEATURE_FLAG_KEY, flagName);
