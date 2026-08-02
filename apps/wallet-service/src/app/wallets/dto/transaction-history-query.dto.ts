import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class TransactionHistoryQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    String(value ?? 'ALL').toUpperCase(),
  )
  @IsIn([
    'ALL',
    'DEPOSIT',
    'WITHDRAWAL',
    'TRANSFER',
  ])
  type:
    | 'ALL'
    | 'DEPOSIT'
    | 'WITHDRAWAL'
    | 'TRANSFER' = 'ALL';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
