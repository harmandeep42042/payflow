import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class DepositWalletDto {
  @ApiProperty({
    example: '4f2b1d1d-5e7d-45df-a26b-98c9d1234567',
  })
  @IsUUID()
  walletId!: string;

  @ApiProperty({
    example: '500.00',
    description: 'Deposit amount as a positive decimal string',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'Amount must be a positive number with up to 2 decimal places',
  })
  amount!: string;

  @ApiProperty({
    example: 'INR',
  })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({
    example: 'BANK-DEPOSIT-001',
  })
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @ApiProperty({
    example: 'deposit-001',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}