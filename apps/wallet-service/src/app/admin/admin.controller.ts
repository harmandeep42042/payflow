import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import {
  AdminService,
  AdminUserRole,
  AdminUserStatus,
} from './admin.service';

type AdminWalletStatus =
  | 'ALL'
  | 'ACTIVE'
  | 'FROZEN'
  | 'CLOSED';

type UpdateWalletStatusDto = {
  status:
    | 'ACTIVE'
    | 'FROZEN'
    | 'CLOSED';
};

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary:
      'Get live Payflow administration dashboard data',
  })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  @ApiOperation({
    summary:
      'Get paginated users for administration',
  })
  getUsers(
    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,

    @Query('search')
    search?: string,

    @Query('status')
    status?: AdminUserStatus,

    @Query('role')
    role?: AdminUserRole,
  ) {
    return this.adminService.getUsers({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search,
      status,
      role,
    });
  }

  @Get('wallets')
  @ApiOperation({
    summary:
      'Get paginated wallets for administration',
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
    name: 'status',
    required: false,
    enum: [
      'ALL',
      'ACTIVE',
      'FROZEN',
      'CLOSED',
    ],
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    example: 'INR',
  })
  getWallets(
    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,

    @Query('search')
    search?: string,

    @Query('status')
    status?: AdminWalletStatus,

    @Query('currency')
    currency?: string,
  ) {
    return this.adminService.getWallets({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search,
      status,
      currency,
    });
  }

  @Patch('wallets/:walletId/status')
  @ApiOperation({
    summary:
      'Update wallet status for administration',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet UUID',
  })
  updateWalletStatus(
    @Param(
      'walletId',
      new ParseUUIDPipe(),
    )
    walletId: string,

    @Body()
    body: UpdateWalletStatusDto,
  ) {
    return this.adminService.updateWalletStatus(
      walletId,
      body.status,
    );
  }

  @Get('transactions')
  @ApiOperation({
    summary:
      'Get paginated transactions for administration',
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
    enum: [
      'ALL',
      'DEPOSIT',
      'WITHDRAWAL',
      'TRANSFER',
    ],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'ALL',
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'REVERSED',
    ],
  })
  getTransactions(
    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,

    @Query('search')
    search?: string,

    @Query('type')
    type?:
      | 'ALL'
      | 'DEPOSIT'
      | 'WITHDRAWAL'
      | 'TRANSFER',

    @Query('status')
    status?: string,
  ) {
    return this.adminService.getTransactions({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search,
      type,
      status,
    });
  }

  @Get('transactions/:transactionId')
  @ApiOperation({
    summary:
      'Get complete transaction details for administration',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction UUID',
  })
  getTransactionById(
    @Param(
      'transactionId',
      new ParseUUIDPipe(),
    )
    transactionId: string,
  ) {
    return this.adminService
      .getTransactionById(
        transactionId,
      );
  }

  @Get('analytics')
  @ApiOperation({
    summary:
      'Get administration analytics data',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    example: 7,
    description:
      'Analytics period between 1 and 90 days',
  })
  getAnalytics(
    @Query('days')
    days?: string,
  ) {
    return this.adminService.getAnalytics({
      days: days
        ? Number(days)
        : 7,
    });
  }
}