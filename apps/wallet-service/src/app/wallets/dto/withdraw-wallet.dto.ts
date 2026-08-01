import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class WithdrawWalletDto {
  @IsUUID()
  walletId!: string;

  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsString()
  @Matches(/^[0-9]+(?:\.[0-9]{1,2})?$/)
  amount!: string;

  @IsUUID()
  idempotencyKey!: string;

  @IsString()
  @IsNotEmpty()
  reference!: string;
}