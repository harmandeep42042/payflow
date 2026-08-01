import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class TransferWalletDto {
  @IsUUID()
  @IsNotEmpty()
  sourceWalletId!: string;

  @IsUUID()
  @IsNotEmpty()
  destinationWalletId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter uppercase code',
  })
  currency!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]+(?:\.[0-9]{1,2})?$/, {
    message: 'amount must be a valid positive decimal string',
  })
  @Matches(/^(?!0+(?:\.0+)?$).+$/, {
    message: 'amount must be greater than 0',
  })
  amount!: string;

  @IsUUID()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  description?: string;
}