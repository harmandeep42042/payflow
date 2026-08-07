import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMockPaymentDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  walletId!: string;

  @IsInt()
  @Min(100, {
    message:
      'Amount must be at least 100 paise',
  })
  amountInPaise!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string;
}