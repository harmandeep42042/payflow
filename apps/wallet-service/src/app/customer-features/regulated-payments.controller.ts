import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WalletRoles } from '../wallet-auth/decorators/wallet-roles.decorator';
import { WalletJwtAuthGuard } from '../wallet-auth/guards/wallet-jwt-auth.guard';
import { WalletRolesGuard } from '../wallet-auth/guards/wallet-roles.guard';
import {
  AddPaymentMethodDto,
  ClassifyTransactionDto,
  CreatePaymentTemplateDto,
  CreateRecurringScheduleDto,
  MerchantProfileDto,
  RequestRefundDto,
  ReviewRiskSignalDto,
  LinkBankAccountDto,
  SetVpaDto,
} from './regulated-payments.dto';
import { RegulatedPaymentsService } from './regulated-payments.service';
type AuthRequest = { user: { id: string } };

@UseGuards(WalletJwtAuthGuard)
@Controller('customer-features')
export class RegulatedPaymentsController {
  constructor(private readonly service: RegulatedPaymentsService) {}
  @Get('regulated/providers') providers() {
    return this.service.providerArchitecture();
  }
  @Get('upi/identity') vpa(@Req() req: AuthRequest) {
    return this.service.vpa(req.user.id);
  }
  @Patch('upi/identity') setVpa(
    @Req() req: AuthRequest,
    @Body() dto: SetVpaDto,
  ) {
    return this.service.setVpa(req.user.id, dto);
  }
  @Get('upi/payments') upiPayments(@Req() req: AuthRequest) {
    return this.service.upiPayments(req.user.id);
  }
  @Get('payment-authentication') authState(@Req() req: AuthRequest) {
    return this.service.paymentAuthState(req.user.id);
  }
  @Get('bank-accounts') bankAccounts(@Req() req: AuthRequest) {
    return this.service.bankAccounts(req.user.id);
  }
  @Post('bank-accounts') linkBank(
    @Req() req: AuthRequest,
    @Body() dto: LinkBankAccountDto,
  ) {
    return this.service.linkBankAccount(req.user.id, dto);
  }
  @Delete('bank-accounts/:id') unlinkBank(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.unlinkBankAccount(req.user.id, id);
  }
  @Get('payment-methods') paymentMethods(@Req() req: AuthRequest) {
    return this.service.paymentMethods(req.user.id);
  }
  @Post('payment-methods') addPaymentMethod(
    @Req() req: AuthRequest,
    @Body() dto: AddPaymentMethodDto,
  ) {
    return this.service.addPaymentMethod(req.user.id, dto);
  }
  @Delete('payment-methods/:id') removePaymentMethod(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.removePaymentMethod(req.user.id, id);
  }
  @Get('merchants') merchants() {
    return this.service.merchants();
  }
  @Get('merchant/profile')
  merchantProfile(@Req() req: AuthRequest) {
    return this.service.merchantProfile(req.user.id);
  }

  @Patch('merchant/profile')
  saveMerchantProfile(
    @Req() req: AuthRequest,
    @Body() dto: MerchantProfileDto,
  ) {
    return this.service.saveMerchantProfile(req.user.id, dto);
  }

  @Post('merchant-payments/:id/refund')
  requestMerchantRefund(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: RequestRefundDto,
  ) {
    return this.service.requestRefund(req.user.id, id, dto);
  }
  @Get('merchant-payments') merchantPayments(@Req() req: AuthRequest) {
    return this.service.merchantPayments(req.user.id);
  }
  @Get('merchant-payments/:id')
  merchantPaymentReceipt(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.merchantPaymentReceipt(
      req.user.id,
      id,
    );
  }
  @Patch('transactions/:id/category') classify(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: ClassifyTransactionDto,
  ) {
    return this.service.classify(req.user.id, id, dto);
  }
  @Get('payment-templates') templates(@Req() req: AuthRequest) {
    return this.service.templates(req.user.id);
  }
  @Post('payment-templates') template(
    @Req() req: AuthRequest,
    @Body() dto: CreatePaymentTemplateDto,
  ) {
    return this.service.createTemplate(req.user.id, dto);
  }
  @Patch('payment-templates/:id') updateTemplate(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreatePaymentTemplateDto,
  ) {
    return this.service.updateTemplate(req.user.id, id, dto);
  }
  @Delete('payment-templates/:id') deleteTemplate(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.deleteTemplate(req.user.id, id);
  }
  @Get('recurring-payments') schedules(@Req() req: AuthRequest) {
    return this.service.schedules(req.user.id);
  }
  @Post('recurring-payments') schedule(
    @Req() req: AuthRequest,
    @Body() dto: CreateRecurringScheduleDto,
  MerchantProfileDto,
  RequestRefundDto,
  ) {
    return this.service.createSchedule(req.user.id, dto);
  }
  @Post('recurring-payments/:id/pause') pause(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.scheduleAction(req.user.id, id, 'pause');
  }
  @Post('recurring-payments/:id/resume') resume(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.scheduleAction(req.user.id, id, 'resume');
  }
  @Post('recurring-payments/:id/cancel') cancel(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.scheduleAction(req.user.id, id, 'cancel');
  }
  @Get('statements') statement(
    @Req() req: AuthRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.statement(req.user.id, from, to);
  }
  @Get('risk')
  risk(@Req() req: AuthRequest) {
    return this.service.riskState(req.user.id);
  }

  @Get('admin/risk-signals')
  @UseGuards(WalletRolesGuard)
  @WalletRoles('ADMIN')
  adminRiskSignals(
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.service.adminRiskSignals(search, status);
  }

  @Patch('admin/risk-signals/:id')
  @UseGuards(WalletRolesGuard)
  @WalletRoles('ADMIN')
  reviewRiskSignal(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: ReviewRiskSignalDto,
  ) {
    return this.service.reviewRiskSignal(
      {
        id: req.user.id,
        email: '',
      },
      id,
      dto,
    );
  }

  @Get('admin/regulated-payments')
  @UseGuards(WalletRolesGuard)
  @WalletRoles('ADMIN')
  admin() {
    return this.service.adminOperations();
  }
}


