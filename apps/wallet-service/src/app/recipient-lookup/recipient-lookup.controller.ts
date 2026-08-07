import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import {
  RecipientLookupService,
} from './recipient-lookup.service';

@ApiTags('Wallet Recipients')
@Controller('wallet-recipients')
export class RecipientLookupController {
  constructor(
    private readonly recipientLookupService:
      RecipientLookupService,
  ) {}

  @Get('resolve')
  @ApiOperation({
    summary:
      'Resolve a recipient wallet using email',
  })
  @ApiQuery({
    name:
      'email',

    required:
      true,
  })
  @ApiQuery({
    name:
      'currency',

    required:
      false,

    example:
      'INR',
  })
  @ApiQuery({
    name:
      'excludeUserId',

    required:
      false,
  })
  resolveRecipient(
    @Query('email')
    email = '',

    @Query('currency')
    currency = 'INR',

    @Query('excludeUserId')
    excludeUserId?: string,
  ) {
    return this.recipientLookupService
      .resolveRecipient({
        email,
        currency,
        excludeUserId,
      });
  }
}