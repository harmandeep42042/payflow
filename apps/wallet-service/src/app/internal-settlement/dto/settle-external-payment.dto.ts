import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class SettleExternalPaymentDto {
  @IsUUID()
  paymentId!: string;

  @IsUUID()
  walletId!: string;

  @IsString()
  @IsNotEmpty()
  providerPaymentId!: string;

  @IsInt()
  @Min(1)
  amountInPaise!: number;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency!: string;
}
