import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class DepositWalletDto {
  @IsUUID()
  @IsNotEmpty()
  walletId!: string;

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

  @IsString()
  @IsNotEmpty()
  reference!: string;
}