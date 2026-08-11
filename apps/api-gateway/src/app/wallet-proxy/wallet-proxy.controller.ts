import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
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

import {
  WalletProxyService,
} from './wallet-proxy.service';

type TransactionHistoryQuery = {
  type?: string;
  page?: string;
  limit?: string;
};

type AuthenticatedWalletRequest = {
  headers: {
    authorization?: string;
  };
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

  @Post()
  @ApiOperation({
    summary:
      'Create a wallet through the protected Gateway route',
  })
  @ApiResponse({
    status: 201,
    description:
      'Wallet created successfully',
  })
  createWallet(
    @Body()
    body: unknown,
  ) {
    return this.walletProxyService
      .createWallet(body);
  }

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
    @Param('userId')
    userId: string,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletProxyService
      .getUserWallets(
        userId,
        request.headers.authorization,
      );
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
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  getTransactionHistory(
    @Param('walletId')
    walletId: string,

    @Query()
    query: TransactionHistoryQuery,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletProxyService
      .getTransactionHistory(
        walletId,
        query,
        request.headers.authorization,
      );
  }

  @Get(':walletId')
  @ApiOperation({
    summary:
      'Get protected wallet details',
  })
  getWallet(
    @Param('walletId')
    walletId: string,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletProxyService
      .getWallet(
        walletId,
        request.headers.authorization,
      );
  }

  @Post('deposit')
  @ApiOperation({
    summary:
      'Deposit through protected Gateway route',
  })
  deposit(
    @Body()
    body: unknown,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletProxyService
      .deposit(
        body,
        request.headers.authorization,
      );
  }

  @Post('withdraw')
  @ApiOperation({
    summary:
      'Withdraw through protected Gateway route',
  })
  withdraw(
    @Body()
    body: unknown,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletProxyService
      .withdraw(
        body,
        request.headers.authorization,
      );
  }

  @Post('transfer')
  @ApiOperation({
    summary:
      'Transfer through protected Gateway route',
  })
  transfer(
    @Body()
    body: unknown,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletProxyService
      .transfer(
        body,
        request.headers.authorization,
      );
  }
}
