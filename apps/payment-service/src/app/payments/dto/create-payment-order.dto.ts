import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePaymentOrderDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  walletId!: string;

  @IsInt()
  @Min(100)
  amountInPaise!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}