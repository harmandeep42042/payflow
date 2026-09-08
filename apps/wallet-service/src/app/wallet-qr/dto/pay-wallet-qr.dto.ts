import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class PayWalletQrDto {
  @ApiProperty({
    description: 'Signed Payflow QR payment payload',
  })
  @IsString()
  @IsNotEmpty()
  payload!: string;

  @ApiPropertyOptional({
    description: 'Optional payment description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
