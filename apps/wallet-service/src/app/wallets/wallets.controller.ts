import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  WalletJwtAuthGuard,
} from '../wallet-auth/guards/wallet-jwt-auth.guard';

import { CreateWalletDto } from './dto/create-wallet.dto';
import { DepositWalletDto } from './dto/deposit-wallet.dto';
import { TransactionHistoryQueryDto } from './dto/transaction-history-query.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';
import { WithdrawWalletDto } from './dto/withdraw-wallet.dto';
import { WalletsService } from './wallets.service';

type AuthenticatedWalletRequest = {
  user?: {
    id: string;
    email: string;
    role: string;
  };
};

@ApiTags('Wallets')
@ApiBearerAuth('access-token')
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Check Wallet Service status',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet module is working',
  })
  getWalletsStatus() {
    return this.walletsService.getStatus();
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new wallet for a user',
  })
  @ApiResponse({
    status: 201,
    description: 'Wallet created successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Wallet already exists for the selected currency',
  })
  createWallet(
    @Body() dto: CreateWalletDto,
  ) {
    return this.walletsService.createWallet(dto);
  }

  @Post('deposit')
  @UseGuards(WalletJwtAuthGuard)
  @ApiOperation({
    summary: 'Deposit money into a wallet',
  })
  @ApiResponse({
    status: 201,
    description: 'Deposit completed successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid wallet status, currency or amount',
  })
  @ApiResponse({
    status: 404,
    description:
      'Wallet or ledger account not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Wallet was updated by another transaction',
  })
  depositWallet(
    @Body() dto: DepositWalletDto,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletsService.depositWallet(
      dto,
      request.user?.id,
    );
  }

  @Post('withdraw')
  @UseGuards(WalletJwtAuthGuard)
  @ApiOperation({
    summary: 'Withdraw money from a wallet',
  })
  @ApiResponse({
    status: 201,
    description:
      'Withdrawal completed successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request or insufficient wallet balance',
  })
  @ApiResponse({
    status: 404,
    description:
      'Wallet or ledger account not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Wallet balance or version changed',
  })
  withdrawWallet(
    @Body() dto: WithdrawWalletDto,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletsService.withdrawWallet(
      dto,
      request.user?.id,
    );
  }

  @Post('transfer')
  @UseGuards(WalletJwtAuthGuard)
  @ApiOperation({
    summary:
      'Transfer money between two wallets',
  })
  @ApiResponse({
    status: 201,
    description:
      'Wallet transfer completed successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid wallets, currency or insufficient balance',
  })
  @ApiResponse({
    status: 404,
    description:
      'Source or destination wallet not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Wallet version changed during transfer',
  })
  transferWallet(
    @Body()
    dto: TransferWalletDto,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletsService.transferWallet(
      dto,
      request.user?.id,
    );
  }

  @Get('user/:userId')
  @UseGuards(WalletJwtAuthGuard)
  @ApiOperation({
    summary: 'Get all wallets belonging to a user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example:
      '4f2b1d1d-5e7d-45df-a26b-98c9d1234567',
  })
  @ApiResponse({
    status: 200,
    description:
      'User wallets returned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  getUserWallets(
    @Param('userId', new ParseUUIDPipe())
    userId: string,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletsService.getUserWallets(
      userId,
      request.user?.id,
    );
  }

  @Get(':walletId/transactions')
  @UseGuards(WalletJwtAuthGuard)
  @ApiOperation({
    summary:
      'Get paginated wallet transaction history',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet UUID',
    example:
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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
  getTransactionHistory(
    @Param('walletId', new ParseUUIDPipe())
    walletId: string,
    @Query()
    query: TransactionHistoryQueryDto,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletsService
      .getTransactionHistory(
        walletId,
        query,
        request.user?.id,
      );
  }

  @Get(':walletId')
  @UseGuards(WalletJwtAuthGuard)
  @ApiOperation({
    summary: 'Get wallet details by wallet ID',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet UUID',
    example:
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  })
  @ApiResponse({
    status: 200,
    description:
      'Wallet details returned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  getWalletById(
    @Param('walletId', new ParseUUIDPipe())
    walletId: string,

    @Req()
    request: AuthenticatedWalletRequest,
  ) {
    return this.walletsService.getWalletById(
      walletId,
      request.user?.id,
    );
  }
}
