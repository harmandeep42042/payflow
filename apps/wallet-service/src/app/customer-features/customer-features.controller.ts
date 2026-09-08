import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { WalletRoles } from '../wallet-auth/decorators/wallet-roles.decorator';
import { WalletJwtAuthGuard } from '../wallet-auth/guards/wallet-jwt-auth.guard';
import { WalletRolesGuard } from '../wallet-auth/guards/wallet-roles.guard';
import {
  AcceptMoneyRequestDto, CreateBillPaymentDto, CreateSavedBillerDto, CreateBillReminderDto, CreateBillSplitDto, CreateContactDto, CreateMandateDto,
  CreateMoneyRequestDto, CreateOfferDto, CreateRechargeDto, CreateSupportCaseDto, PaySplitAllocationDto,
  UpdateContactDto, UpdateOfferDto, UpdateSupportCaseDto,
} from './customer-features.dto';
import { CustomerFeaturesService } from './customer-features.service';

type AuthRequest = { user: { id: string; email: string; role: string } };

@UseGuards(WalletJwtAuthGuard)
@Controller('customer-features')
export class CustomerFeaturesController {
  constructor(private readonly service: CustomerFeaturesService) {}
  @Get('contacts') contacts(@Req() req: AuthRequest, @Query('search') search?: string) { return this.service.listContacts(req.user.id, search?.trim()); }
  @Post('contacts') createContact(@Req() req: AuthRequest, @Body() dto: CreateContactDto) { return this.service.createContact(req.user.id, dto); }
  @Patch('contacts/:id') updateContact(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateContactDto) { return this.service.updateContact(req.user.id, id, dto); }
  @Delete('contacts/:id') deleteContact(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.deleteContact(req.user.id, id); }
  @Post('contacts/:id/favourite') favourite(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.updateContact(req.user.id, id, { favourite: true }); }
  @Delete('contacts/:id/favourite') unfavourite(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.updateContact(req.user.id, id, { favourite: false }); }

  @Get('money-requests') moneyRequests(@Req() req: AuthRequest) { return this.service.listMoneyRequests(req.user.id); }
  @Post('money-requests') createMoneyRequest(@Req() req: AuthRequest, @Body() dto: CreateMoneyRequestDto) { return this.service.createMoneyRequest(req.user.id, dto); }
  @Post('money-requests/:id/accept') acceptMoneyRequest(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: AcceptMoneyRequestDto) { return this.service.acceptMoneyRequest(req.user.id, id, dto); }
  @Post('money-requests/:id/decline') declineMoneyRequest(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.transitionMoneyRequest(req.user.id, id, 'DECLINED'); }
  @Post('money-requests/:id/cancel') cancelMoneyRequest(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.transitionMoneyRequest(req.user.id, id, 'CANCELLED'); }

  @Get('splits') splits(@Req() req: AuthRequest) { return this.service.listSplits(req.user.id); }
  @Post('splits') createSplit(@Req() req: AuthRequest, @Body() dto: CreateBillSplitDto) { return this.service.createSplit(req.user.id, dto); }
  @Post('split-allocations/:id/pay') paySplit(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: PaySplitAllocationDto) { return this.service.payAllocation(req.user.id, id, dto); }
  @Post('splits/:id/cancel') cancelSplit(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.cancelSplit(req.user.id, id); }

  @Get('offers') offers(@Req() req: AuthRequest) { return this.service.listOffers(req.user.id); }
  @Get('offers/:id') offer(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.getOffer(req.user.id, id); }
  @Post('offers/:id/claim') claimOffer(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.claimOffer(req.user.id, id); }

  @Get('providers/status') providerStatus() { return this.service.providerStatus(); }
  @Get('insights') insights(@Req() req: AuthRequest, @Query('from') from?: string, @Query('to') to?: string, @Query('days') days?: string, @Query('category') category?: string) { return this.service.insights(req.user.id, from, to, days, category); }
  @Get('recharges') recharges(@Req() req: AuthRequest) { return this.service.rechargeHistory(req.user.id); }
  @Get('recharges/plans') rechargePlans() { return this.service.rechargePlans(); }
  @Post('recharges') recharge(@Req() req: AuthRequest, @Body() dto: CreateRechargeDto) { return this.service.createRecharge(req.user.id, dto); }
  @Get('bill-payments') billPayments(@Req() req: AuthRequest) { return this.service.billHistory(req.user.id); }
  @Get('billers') billers() { return this.service.billers(); }
  @Post('bills/validate') validateBill() { return this.service.validateBill(); }
  @Post('bill-payments') billPayment(@Req() req: AuthRequest, @Body() dto: CreateBillPaymentDto) { return this.service.createBillPayment(req.user.id, dto); }
  @Get('saved-billers')
savedBillers(@Req() req: AuthRequest) {
  return this.service.listSavedBillers(req.user.id);
}

@Post('saved-billers')
createSavedBiller(
  @Req() req: AuthRequest,
  @Body() dto: CreateSavedBillerDto,
) {
  return this.service.createSavedBiller(req.user.id, dto);
}

@Delete('saved-billers/:id')
deleteSavedBiller(
  @Req() req: AuthRequest,
  @Param('id') id: string,
) {
  return this.service.deleteSavedBiller(req.user.id, id);
}
@Get('bill-reminders')
billReminders(@Req() req: AuthRequest) {
  return this.service.listBillReminders(
    req.user.id,
  );
}

@Post('bill-reminders')
createBillReminder(
  @Req() req: AuthRequest,
  @Body() dto: CreateBillReminderDto,
) {
  return this.service.createBillReminder(
    req.user.id,
    dto,
  );
}

@Delete('bill-reminders/:id')
deleteBillReminder(
  @Req() req: AuthRequest,
  @Param('id') id: string,
) {
  return this.service.deleteBillReminder(
    req.user.id,
    id,
  );
}
@Get('mandates') mandates(@Req() req: AuthRequest) { return this.service.mandates(req.user.id); }
  @Get('mandates/:id') mandateDetails(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.mandate(req.user.id, id); }
  @Post('mandates') mandate(@Req() req: AuthRequest, @Body() dto: CreateMandateDto) { return this.service.createMandate(req.user.id, dto); }
  @Post('mandates/:id/authorize') authorizeMandate(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.mandateAction(req.user.id, id, 'authorize'); }
  @Post('mandates/:id/pause') pauseMandate(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.mandateAction(req.user.id, id, 'pause'); }
  @Post('mandates/:id/resume') resumeMandate(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.mandateAction(req.user.id, id, 'resume'); }
  @Post('mandates/:id/cancel') cancelMandate(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.mandateAction(req.user.id, id, 'cancel'); }

  @Get('support-cases') cases(@Req() req: AuthRequest) { return this.service.cases(req.user.id); }
  @Post('support-cases') createCase(@Req() req: AuthRequest, @Body() dto: CreateSupportCaseDto) { return this.service.createCase(req.user.id, dto); }
  @Get('support-cases/:id') caseDetails(@Req() req: AuthRequest, @Param('id') id: string) { return this.service.caseDetails(req.user.id, id); }

  @Get('admin/offers') @UseGuards(WalletRolesGuard) @WalletRoles('ADMIN') adminOffers() { return this.service.adminOffers(); }
  @Post('admin/offers') @UseGuards(WalletRolesGuard) @WalletRoles('ADMIN') createOffer(@Req() req: AuthRequest, @Body() dto: CreateOfferDto) { return this.service.createOffer(req.user, dto); }
  @Patch('admin/offers/:id') @UseGuards(WalletRolesGuard) @WalletRoles('ADMIN') updateOffer(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateOfferDto) { return this.service.updateOffer(req.user, id, dto); }
  @Get('admin/support-cases') @UseGuards(WalletRolesGuard) @WalletRoles('ADMIN') adminCases() { return this.service.adminCases(); }
  @Patch('admin/support-cases/:id') @UseGuards(WalletRolesGuard) @WalletRoles('ADMIN') updateCase(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateSupportCaseDto) { return this.service.updateCase(req.user, id, dto); }
  @Get('admin/money-requests') @UseGuards(WalletRolesGuard) @WalletRoles('ADMIN') adminMoneyRequests() { return this.service.adminMoneyRequests(); }
  @Get('admin/splits') @UseGuards(WalletRolesGuard) @WalletRoles('ADMIN') adminSplits() { return this.service.adminSplits(); }
  @Get('admin/mandates') @UseGuards(WalletRolesGuard) @WalletRoles('ADMIN') adminMandates() { return this.service.adminMandates(); }
  @Get('admin/providers/status') @UseGuards(WalletRolesGuard) @WalletRoles('ADMIN') adminProviderStatus() { return this.service.adminProviderOperations(); }
}
