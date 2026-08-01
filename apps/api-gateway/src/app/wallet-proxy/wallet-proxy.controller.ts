import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { WalletProxyService } from './wallet-proxy.service';

@Controller('wallets')
export class WalletProxyController {
  constructor(
    private readonly walletProxyService: WalletProxyService,
  ) {}

  @Get(':walletId')
  getWallet(@Param('walletId') walletId: string) {
    return this.walletProxyService.getWallet(walletId);
  }

  @Get('user/:userId')
  getUserWallets(@Param('userId') userId: string) {
    return this.walletProxyService.getUserWallets(userId);
  }

  @Post('deposit')
  deposit(@Body() body: unknown) {
    return this.walletProxyService.deposit(body);
  }

  @Post('withdraw')
  withdraw(@Body() body: unknown) {
    return this.walletProxyService.withdraw(body);
  }

  @Post('transfer')
  transfer(@Body() body: unknown) {
    return this.walletProxyService.transfer(body);
  }
}