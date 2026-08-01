import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { DepositWalletDto } from './dto/deposit-wallet.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';
import { WithdrawWalletDto } from './dto/withdraw-wallet.dto';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  getWalletsStatus() {
    return this.walletsService.getStatus();
  }

  @Post()
  createWallet(@Body() dto: CreateWalletDto) {
    return this.walletsService.createWallet(dto);
  }

  @Post('deposit')
  depositWallet(@Body() dto: DepositWalletDto) {
    return this.walletsService.depositWallet(dto);
  }

  @Post('withdraw')
  withdrawWallet(@Body() dto: WithdrawWalletDto) {
    return this.walletsService.withdrawWallet(dto);
  }

  @Post('transfer')
  transferWallet(@Body() dto: TransferWalletDto) {
    return this.walletsService.transferWallet(dto);
  }

  @Get('user/:userId')
  getUserWallets(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.walletsService.getUserWallets(userId);
  }

  @Get(':walletId')
  getWalletById(
    @Param('walletId', new ParseUUIDPipe()) walletId: string,
  ) {
    return this.walletsService.getWalletById(walletId);
  }
}