import { IsIn, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['INR'])
  currency!: string;
}