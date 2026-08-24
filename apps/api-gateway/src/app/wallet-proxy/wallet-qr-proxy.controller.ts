import {
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  GatewayJwtAuthGuard,
} from '../gateway-auth/guards/gateway-jwt-auth.guard';

import {
  WalletProxyService,
} from './wallet-proxy.service';

type AuthenticatedWalletRequest = {
  headers: {
    authorization?: string;
  };
};

@ApiTags('Wallet QR')
@ApiBearerAuth('access-token')
@UseGuards(GatewayJwtAuthGuard)
@Controller('wallet-qr')
export class WalletQrProxyController {
  constructor(
    private readonly walletProxyService:
      WalletProxyService,
  ) {}

  @Get('my')
  @ApiOperation({
    summary:
      'Generate QR code for the authenticated user',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    example: 'INR',
  })
  @ApiResponse({
    status: 200,
    description:
      'Payment QR generated successfully',
  })
  generateMyQr(
    @Query('currency')
    currency = 'INR',

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletProxyService.generateMyQr(
      {
        currency,
      },
      request.headers.authorization,
    );
  }
}
