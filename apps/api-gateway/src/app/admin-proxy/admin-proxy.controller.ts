import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { Roles } from '../gateway-auth/decorators/roles.decorator';
import { GatewayJwtAuthGuard } from '../gateway-auth/guards/gateway-jwt-auth.guard';
import { RolesGuard } from '../gateway-auth/guards/roles.guard';
import { AdminProxyService } from './admin-proxy.service';
import {
  UpdateAdminUserStatusDto,
  UpdateAdminWalletStatusDto,
} from './dto/update-admin-status.dto';

type AdminUsersQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  role?: string;
};

type AdminWalletsQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  currency?: string;
};

type AdminTransactionsQuery = {
  page?: string;
  limit?: string;
  search?: string;
  type?: string;
  status?: string;
};

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(GatewayJwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminProxyController {
  constructor(private readonly adminProxyService: AdminProxyService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get live administration dashboard data',
  })
  getDashboard(@Req() req: Request) {
    return this.adminProxyService.getDashboard(req.headers.authorization);
  }

  @Get('users')
  getUsers(@Query() query: AdminUsersQuery, @Req() req: Request) {
    return this.adminProxyService.getUsers(query, req.headers.authorization);
  }

  @Get('users/:userId')
  @ApiOperation({
    summary: 'Get complete user details through admin Gateway',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
  })
  getUserById(
    @Param('userId', new ParseUUIDPipe())
    userId: string,
    @Req() req: Request,
  ) {
    return this.adminProxyService.getUserById(
      userId,
      req.headers.authorization,
    );
  }

  @Patch('users/:userId/status')
  @ApiOperation({
    summary: 'Update user status through admin Gateway',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
  })
  updateUserStatus(
    @Param('userId', new ParseUUIDPipe())
    userId: string,

    @Body()
    body: UpdateAdminUserStatusDto,

    @Req()
    req: Request,
  ) {
    return this.adminProxyService.updateUserStatus(
      userId,
      body,
      req.headers.authorization,
    );
  }
  @Get('wallets')
  getWallets(
    @Query()
    query: AdminWalletsQuery,

    @Req()
    req: Request,
  ) {
    return this.adminProxyService.getWallets(query, req.headers.authorization);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Get paginated administration transactions list',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['ALL', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER'],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ALL', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED'],
  })
  getTransactions(
    @Query()
    query: AdminTransactionsQuery,

    @Req()
    req: Request,
  ) {
    return this.adminProxyService.getTransactions(
      query,
      req.headers.authorization,
    );
  }

  @Patch('wallets/:walletId/status')
  @ApiOperation({
    summary: 'Update wallet status through admin Gateway',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet UUID',
  })
  updateWalletStatus(
    @Param('walletId', new ParseUUIDPipe())
    walletId: string,

    @Body()
    body: UpdateAdminWalletStatusDto,

    @Req()
    req: Request,
  ) {
    return this.adminProxyService.updateWalletStatus(
      walletId,
      body,
      req.headers.authorization,
    );
  }

  @Post('transactions/:transactionId/reverse')
  @ApiOperation({
    summary: 'Administratively reverse a completed transfer',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transfer transaction UUID',
  })
  reverseTransaction(
    @Param('transactionId', new ParseUUIDPipe())
    transactionId: string,

    @Body()
    body: {
      reason?: string;
    },

    @Req()
    req: Request,
  ) {
    return this.adminProxyService.reverseTransaction(
      transactionId,
      body,
      req.headers.authorization,
    );
  }

  @Get('transactions/review')
  @ApiOperation({
    summary: 'Get transactions requiring manual accounting review',
  })
  getTransactionsForReview(
    @Req()
    req: Request,
  ) {
    return this.adminProxyService.getTransactionsForReview(
      req.headers.authorization,
    );
  }

  @Get('transactions/:transactionId/review')
  @ApiOperation({
    summary: 'Get manual accounting review evidence for a transaction',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transfer transaction UUID',
  })
  getTransactionReview(
    @Param('transactionId', new ParseUUIDPipe())
    transactionId: string,

    @Req()
    req: Request,
  ) {
    return this.adminProxyService.getTransactionReview(
      transactionId,
      req.headers.authorization,
    );
  }

  @Post('transactions/:transactionId/review/fail')
  @ApiOperation({
    summary: 'Resolve transaction manual review as FAILED',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transfer transaction UUID',
  })
  failTransactionReview(
    @Param('transactionId', new ParseUUIDPipe())
    transactionId: string,

    @Body()
    body: {
      reason?: string;
    },

    @Req()
    req: Request,
  ) {
    return this.adminProxyService.failTransactionReview(
      transactionId,
      body,
      req.headers.authorization,
    );
  }
  @Get('transactions/:transactionId')
  @ApiOperation({
    summary: 'Get complete transaction details through admin Gateway',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction UUID',
  })
  getTransactionById(
    @Param('transactionId', new ParseUUIDPipe())
    transactionId: string,

    @Req()
    req: Request,
  ) {
    return this.adminProxyService.getTransactionById(
      transactionId,
      req.headers.authorization,
    );
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: 'Get administration audit logs through Gateway',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: 'action',
    required: false,
  })
  @ApiQuery({
    name: 'targetType',
    required: false,
  })
  @ApiQuery({
    name: 'actorUserId',
    required: false,
  })
  getAuditLogs(
    @Req()
    req: Request,

    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,

    @Query('action')
    action?: string,

    @Query('targetType')
    targetType?: string,

    @Query('actorUserId')
    actorUserId?: string,
  ) {
    return this.adminProxyService.getAuditLogs(
      {
        page,
        limit,
        action,
        targetType,
        actorUserId,
      },
      req.headers.authorization,
    );
  }
  @Get('analytics')
  @ApiOperation({
    summary: 'Get administration analytics through Gateway',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    example: 7,
  })
  getAnalytics(
    @Req()
    req: Request,

    @Query('days')
    days?: string,
  ) {
    return this.adminProxyService.getAnalytics(days, req.headers.authorization);
  }

  @Get('dlq')
  @ApiOperation({
    summary: 'Get notification dead-letter queue records',
  })
  getDlqRecords(
    @Req()
    req: Request,

    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,

    @Query('status')
    status?: string,
  ) {
    return this.adminProxyService.getDlqRecords(
      {
        page,
        limit,
        status,
      },
      req.headers.authorization,
    );
  }

  @Get('dlq/:id')
  @ApiOperation({
    summary: 'Get notification dead-letter queue record',
  })
  getDlqRecord(
    @Param('id')
    id: string,

    @Req()
    req: Request,
  ) {
    return this.adminProxyService.getDlqRecord(id, req.headers.authorization);
  }

  @Post('dlq/:id/replay')
  @ApiOperation({
    summary: 'Replay notification dead-letter queue record',
  })
  replayDlqRecord(
    @Param('id')
    id: string,

    @Req()
    req: Request,
  ) {
    const user = req.user as
      | {
          id?: string;
          email?: string;
        }
      | undefined;

    return this.adminProxyService.replayDlqRecord(
      id,
      user?.email || user?.id || 'gateway-admin',
      req.headers.authorization,
    );
  }
}
