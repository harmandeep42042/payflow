import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  GatewayJwtAuthGuard,
} from '../gateway-auth/guards/gateway-jwt-auth.guard';
import { WalletProxyService } from './wallet-proxy.service';

type TransactionHistoryQuery = {
  type?: string;
  page?: string;
  limit?: string;
};

@ApiTags('Wallets')
@ApiBearerAuth('access-token')
@UseGuards(GatewayJwtAuthGuard)
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
  @ApiResponse({
    status: 401,
    description:
      'Access token missing or invalid',
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
      'Get protected wallet transaction history',
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
      'Transaction history returned',
  })
  @ApiResponse({
    status: 401,
    description:
      'Access token missing or invalid',
  })
  getTransactionHistory(
    @Param('walletId')
    walletId: string,

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
      'Get protected wallet details',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet UUID',
  })
  getWallet(
    @Param('walletId')
    walletId: string,
  ) {
    return this.walletProxyService
      .getWallet(walletId);
  }

  @Post('deposit')
  @ApiOperation({
    summary:
      'Deposit through protected Gateway route',
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
      'Withdraw through protected Gateway route',
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
      'Transfer through protected Gateway route',
  })
  transfer(
    @Body() body: unknown,
  ) {
    return this.walletProxyService
      .transfer(body);
  }
}