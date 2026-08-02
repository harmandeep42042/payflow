import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class TransferWalletDto {
  @ApiProperty({
    example: '11111111-1111-1111-1111-111111111111',
  })
  @IsUUID()
  sourceWalletId!: string;

  @ApiProperty({
    example: '22222222-2222-2222-2222-222222222222',
  })
  @IsUUID()
  destinationWalletId!: string;

  @ApiProperty({
    example: '500.00',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;

  @ApiProperty({
    example: 'INR',
  })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({
    example: 'Wallet Transfer',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    example: 'transfer-001',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}