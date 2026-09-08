import { ForbiddenException } from '@nestjs/common';

export class FeatureDisabledException extends ForbiddenException {
  constructor() {
    super({
      statusCode: 403,
      code: 'FEATURE_DISABLED',
      message: 'This feature is currently unavailable',
      error: 'Forbidden',
    });
  }
}
