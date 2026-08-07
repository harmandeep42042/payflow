import {
  IsIn,
  IsString,
} from 'class-validator';

export class ConfirmMockPaymentDto {
  @IsString()
  @IsIn([
    'SUCCESS',
    'FAILED',
  ])
  result!:
    | 'SUCCESS'
    | 'FAILED';
}