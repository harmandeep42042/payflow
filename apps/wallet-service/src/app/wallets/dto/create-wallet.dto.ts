import {
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class CreateWalletDto {
  @ApiProperty({
    example: "4f2b1d1d-5e7d-45df-a26b-98c9d1234567",
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    example: "INR",
  })
  @IsString()
  @Length(3, 3)
  currency!: string;
}