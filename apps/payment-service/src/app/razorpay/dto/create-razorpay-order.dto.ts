import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRazorpayOrderDto {
  @IsInt()
  @Min(100, {
    message:
      'Amount must be at least 100 paise',
  })
  amountInPaise!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  receipt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string;
}