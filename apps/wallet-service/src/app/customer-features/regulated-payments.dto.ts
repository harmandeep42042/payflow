import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const MONEY = /^\d+(\.\d{1,2})?$/;
const IDEMPOTENCY = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,119}$/;

export class SetVpaDto {
  @IsString() @Matches(/^[a-z0-9._-]{2,80}@[a-z0-9.-]{2,40}$/i) vpa!: string;
}
export class LinkBankAccountDto {
  @IsString() @IsNotEmpty() @MaxLength(120) bankName!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) accountHolderName!: string;
  @IsString() @Matches(/^\d{6,34}$/) accountNumber!: string;
  @IsString() @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/i) ifsc!: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
export class AddPaymentMethodDto {
  @IsIn(['BANK_ACCOUNT', 'CARD_TOKEN', 'RUPAY_TOKEN', 'UPI_VPA']) type!:
    | 'BANK_ACCOUNT'
    | 'CARD_TOKEN'
    | 'RUPAY_TOKEN'
    | 'UPI_VPA';
  @IsString() @IsNotEmpty() @MaxLength(80) label!: string;
  @IsString() @Matches(/^[*•Xx0-9@._ -]{4,100}$/) maskedIdentifier!: string;
  @IsOptional() @IsString() @MaxLength(200) providerTokenRef?: string;
  @IsOptional() @IsString() @MaxLength(30) cardBrand?: string;
  @IsOptional() @Matches(/^(0?[1-9]|1[0-2])$/) expiryMonth?: string;
  @IsOptional() @Matches(/^20\d{2}$/) expiryYear?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
export class ClassifyTransactionDto {
  @IsIn([
    'FOOD',
    'SHOPPING',
    'TRAVEL',
    'BILLS',
    'RECHARGE',
    'TRANSFER',
    'RENT',
    'ENTERTAINMENT',
    'OTHER',
  ])
  category!: string;
}
export class CreatePaymentTemplateDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) destinationRef!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) maskedDestination!: string;
  @IsOptional() @IsString() @Matches(MONEY) amount?: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsOptional() @IsString() @MaxLength(240) note?: string;
}
export class CreateRecurringScheduleDto {
  @IsUUID() templateId!: string;
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']) frequency!:
    | 'DAILY'
    | 'WEEKLY'
    | 'MONTHLY'
    | 'QUARTERLY'
    | 'YEARLY';
  @IsDateString() startAt!: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsString() @Matches(IDEMPOTENCY) idempotencyKey!: string;
}
export class MerchantProfileDto {
  @IsString() @IsNotEmpty() @MaxLength(120) displayName!: string;
  @IsOptional() @IsString() @MaxLength(160) legalName?: string;
  @IsString() @IsNotEmpty() @MaxLength(80) category!: string;
  @IsString()
  @Matches(/^[a-z0-9._-]{2,80}@[a-z0-9.-]{2,40}$/i)
  merchantVpa!: string;
}
export class RequestRefundDto {
  @IsString() @Matches(MONEY) amount!: string;
  @IsOptional() @IsString() @MaxLength(240) reason?: string;
  @IsString() @Matches(IDEMPOTENCY) idempotencyKey!: string;
}
export class ReviewRiskSignalDto {
  @IsIn(['REVIEWED', 'DISMISSED', 'RESOLVED']) status!:
    | 'REVIEWED'
    | 'DISMISSED'
    | 'RESOLVED';
  @IsString() @IsNotEmpty() @MaxLength(500) note!: string;
}
