import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class WithdrawWalletDto {
  @ApiProperty({
    example: '4f2b1d1d-5e7d-45df-a26b-98c9d1234567',
  })
  @IsUUID()
  walletId!: string;

  @ApiProperty({
    example: '250.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;

  @ApiProperty({
    example: 'INR',
  })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({
    example: 'ATM Withdrawal',
  })
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @ApiProperty({
    example: 'withdraw-001',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}