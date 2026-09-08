import {
  Body,
  Controller,
  Get,
  Post,
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

import { WalletJwtAuthGuard } from '../wallet-auth/guards/wallet-jwt-auth.guard';

import { WalletQrService } from './wallet-qr.service';
import { PayWalletQrDto } from './dto/pay-wallet-qr.dto';

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
  constructor(private readonly walletQrService: WalletQrService) {}

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
    @Query('amount') amount?: string,
    @Query('expiresInMinutes') expiresInMinutes?: string,
  ) {
    return this.walletQrService.generateMyQr(
      request.user?.id,
      currency,
      amount,
      expiresInMinutes,
    );
  }

  @Get('merchant')
  @UseGuards(WalletJwtAuthGuard)
  @ApiOperation({
    summary: 'Generate signed QR for authenticated merchant',
  })
  generateMerchantQr(
    @Query('currency') currency = 'INR',
    @Req() request: AuthenticatedWalletRequest,
    @Query('amount') amount?: string,
    @Query('expiresInMinutes') expiresInMinutes?: string,
  ) {
    return this.walletQrService.generateMerchantQr(
      request.user?.id,
      currency,
      amount,
      expiresInMinutes,
    );
  }
  @Get('verify')
  @UseGuards(WalletJwtAuthGuard)
  verify(@Query('payload') payload: string) {
    return this.walletQrService.verifyPayload(payload);
  }

  @Post('pay')
  @UseGuards(WalletJwtAuthGuard)
  @ApiOperation({
    summary: 'Pay a signed exact-amount Payflow QR',
  })
  pay(@Body() dto: PayWalletQrDto, @Req() request: AuthenticatedWalletRequest) {
    return this.walletQrService.payVerifiedQr(
      dto.payload,
      dto.description,
      request.user?.id,
    );
  }
}
