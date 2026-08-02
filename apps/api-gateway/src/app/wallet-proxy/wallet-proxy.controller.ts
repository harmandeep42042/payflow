import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { WalletProxyService } from './wallet-proxy.service';

type TransactionHistoryQuery = {
  type?: string;
  page?: string;
  limit?: string;
};

@ApiTags('Wallets')
@Controller('wallets')
export class WalletProxyController {
  constructor(
    private readonly walletProxyService:
      WalletProxyService,
  ) {}

  @Get('user/:userId')
  @ApiOperation({
    summary:
      'Get all wallets belonging to a user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
  })
  getUserWallets(
    @Param('userId') userId: string,
  ) {
    return this.walletProxyService
      .getUserWallets(userId);
  }

  @Get(':walletId/transactions')
  @ApiOperation({
    summary:
      'Get wallet transaction history through API Gateway',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet UUID',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: [
      'ALL',
      'DEPOSIT',
      'WITHDRAWAL',
      'TRANSFER',
    ],
    example: 'ALL',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description:
      'Transaction history returned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  @ApiResponse({
    status: 503,
    description:
      'Wallet service is unavailable',
  })
  getTransactionHistory(
    @Param('walletId') walletId: string,
    @Query()
    query: TransactionHistoryQuery,
  ) {
    return this.walletProxyService
      .getTransactionHistory(
        walletId,
        query,
      );
  }

  @Get(':walletId')
  @ApiOperation({
    summary:
      'Get wallet details through API Gateway',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet UUID',
  })
  getWallet(
    @Param('walletId') walletId: string,
  ) {
    return this.walletProxyService
      .getWallet(walletId);
  }

  @Post('deposit')
  @ApiOperation({
    summary:
      'Deposit money through API Gateway',
  })
  deposit(
    @Body() body: unknown,
  ) {
    return this.walletProxyService
      .deposit(body);
  }

  @Post('withdraw')
  @ApiOperation({
    summary:
      'Withdraw money through API Gateway',
  })
  withdraw(
    @Body() body: unknown,
  ) {
    return this.walletProxyService
      .withdraw(body);
  }

  @Post('transfer')
  @ApiOperation({
    summary:
      'Transfer money through API Gateway',
  })
  transfer(
    @Body() body: unknown,
  ) {
    return this.walletProxyService
      .transfer(body);
  }
}