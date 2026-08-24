import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import {
  RecipientLookupService,
} from './recipient-lookup.service';
import {
  WalletJwtAuthGuard,
} from '../wallet-auth/guards/wallet-jwt-auth.guard';

type AuthenticatedRecipientRequest = {
  user?: {
    id: string;
  };
};

@ApiTags('Wallet Recipients')
@ApiBearerAuth('access-token')
@Controller('wallet-recipients')
export class RecipientLookupController {
  constructor(
    private readonly recipientLookupService:
      RecipientLookupService,
  ) {}

  @Get('resolve')
  @UseGuards(WalletJwtAuthGuard)
  @ApiOperation({
    summary:
      'Resolve a recipient wallet using email, phone or VPA',
  })
  @ApiQuery({
    name: 'email',
    required: false,
  })
  @ApiQuery({
    name: 'phone',
    required: false,
  })
  @ApiQuery({
    name: 'vpa',
    required: false,
    example: 'harman@payflow',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    example: 'INR',
  })
  resolveRecipient(
    @Req() request: AuthenticatedRecipientRequest,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
    @Query('vpa') vpa?: string,
    @Query('currency') currency = 'INR',
  ) {
    if (!email && !phone && !vpa) {
      throw new BadRequestException(
        'Recipient email, phone or VPA is required',
      );
    }

    return this.recipientLookupService.resolveRecipient({
      email,
      phone,
      vpa,
      currency,
      excludeUserId: request.user?.id,
    });
  }
}
