import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

const MONEY = /^\d+(\.\d{1,2})?$/;

export class CreateContactDto { @IsUUID() recipientUserId!: string; @IsOptional() @IsString() @MaxLength(80) nickname?: string; }
export class UpdateContactDto { @IsOptional() @IsString() @MaxLength(80) nickname?: string; @IsOptional() @IsBoolean() favourite?: boolean; }
export class CreateMoneyRequestDto {
  @IsUUID() payerUserId!: string; @IsUUID() walletId!: string; @IsString() @Length(3, 3) currency!: string;
  @IsString() @Matches(MONEY) amount!: string; @IsOptional() @IsString() @MaxLength(240) note?: string;
  @IsDateString() expiresAt!: string; @IsString() @IsNotEmpty() @MaxLength(120) idempotencyKey!: string;
}
export class AcceptMoneyRequestDto { @IsUUID() sourceWalletId!: string; @IsString() @IsNotEmpty() @MaxLength(120) idempotencyKey!: string; }
export class SplitAllocationDto { @IsUUID() participantUserId!: string; @IsString() @Matches(MONEY) amount!: string; }
export class CreateBillSplitDto {
  @IsUUID() walletId!: string; @IsString() @Length(3, 3) currency!: string; @IsString() @Matches(MONEY) totalAmount!: string;
  @IsIn(['EQUAL', 'EXACT']) type!: 'EQUAL' | 'EXACT'; @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => SplitAllocationDto) allocations!: SplitAllocationDto[];
  @IsOptional() @IsString() @MaxLength(240) note?: string; @IsDateString() dueAt!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) idempotencyKey!: string;
}
export class PaySplitAllocationDto { @IsUUID() sourceWalletId!: string; @IsString() @IsNotEmpty() @MaxLength(120) idempotencyKey!: string; }
export class CreateRechargeDto {
  @IsString() @IsNotEmpty() @MaxLength(80) operator!: string; @IsString() @Matches(/^\+?[1-9]\d{7,14}$/) mobileNumber!: string;
  @IsOptional() @IsString() @MaxLength(120) planId?: string; @IsString() @Matches(MONEY) amount!: string;
  @IsString() @Length(3, 3) currency!: string; @IsString() @IsNotEmpty() @MaxLength(120) idempotencyKey!: string;
}
export class CreateBillPaymentDto {
  @IsIn(['ELECTRICITY', 'WATER', 'GAS', 'INTERNET', 'MOBILE_POSTPAID', 'DTH', 'OTHER']) category!: string;
  @IsOptional() @IsString() @MaxLength(120) billerId?: string; @IsString() @IsNotEmpty() @MaxLength(160) customerRef!: string;
  @IsString() @Matches(MONEY) amount!: string; @IsString() @Length(3, 3) currency!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) idempotencyKey!: string;
}
export class CreateMandateDto {
  @IsString() @IsNotEmpty() @MaxLength(160) merchant!: string; @IsOptional() @IsString() @Matches(MONEY) amount?: string;
  @IsString() @Matches(MONEY) maxAmount!: string; @IsString() @Length(3, 3) currency!: string;
  @IsIn(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']) frequency!: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  @IsDateString() startAt!: string; @IsOptional() @IsDateString() endAt?: string; @IsBoolean() consent!: boolean;
  @IsString() @IsNotEmpty() @MaxLength(120) idempotencyKey!: string;
}
export class CreateSupportCaseDto { @IsOptional() @IsUUID() transactionId?: string; @IsString() @IsNotEmpty() @MaxLength(80) category!: string; @IsString() @IsNotEmpty() @MaxLength(2000) description!: string; }
export class UpdateSupportCaseDto {
  @IsIn(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED']) status!: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED' | 'CLOSED';
  @IsOptional() @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  @IsOptional() @IsString() @MaxLength(2000) resolution?: string;
}
export class CreateOfferDto {
  @IsString() @IsNotEmpty() @MaxLength(160) title!: string; @IsString() @IsNotEmpty() @MaxLength(2000) description!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) merchant!: string; @IsString() @IsNotEmpty() @MaxLength(80) category!: string;
  @IsString() @Length(3, 3) currency!: string; @IsString() @IsNotEmpty() @MaxLength(500) benefitDescription!: string;
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE']) status!: 'DRAFT' | 'ACTIVE' | 'INACTIVE'; @IsDateString() startsAt!: string;
  @IsDateString() expiresAt!: string; @IsOptional() @IsObject() eligibilityRules?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(1) @Max(1000000) usageLimit?: number;
}
export class UpdateOfferDto extends CreateOfferDto {}
