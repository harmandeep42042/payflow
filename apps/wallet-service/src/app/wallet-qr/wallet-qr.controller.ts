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
  WalletJwtAuthGuard,
} from '../wallet-auth/guards/wallet-jwt-auth.guard';

import { WalletQrService } from './wallet-qr.service';

type AuthenticatedWalletRequest = {
  user?: {
    id: string;
    email: string;
    role: string;
  };
};

@ApiTags('Wallet QR')
@ApiBearerAuth('access-token')
@Controller('wallet-qr')
export class WalletQrController {
  constructor(
    private readonly walletQrService: WalletQrService,
  ) {}

  @Get('my')
  @UseGuards(WalletJwtAuthGuard)
  @ApiOperation({
    summary: 'Generate QR code for the authenticated user',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    example: 'INR',
  })
  @ApiResponse({
    status: 200,
    description: 'User payment QR generated successfully',
  })
  generateMyQr(
    @Query('currency') currency = 'INR',
    @Req() request: AuthenticatedWalletRequest,
  ) {
    return this.walletQrService.generateMyQr(
      request.user?.id,
      currency,
    );
  }
}
