import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class TransferByVpaDto {
  @ApiProperty({
    example: 'vpademo@payflow',
  })
  @IsString()
  @IsNotEmpty()
  vpa!: string;

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
    example: 'Payment to VPA recipient',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    example: 'vpa-transfer-001',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
