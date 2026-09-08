import {
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class VerifyMobileOtpDto {
  @IsString()
  @Matches(/^(\+91|91)?[6-9][0-9]{9}$/, {
    message: 'Please enter a valid Indian mobile number',
  })
  phone!: string;

  @IsString()
  @Length(6, 6, {
    message: 'OTP must contain exactly 6 digits',
  })
  @Matches(/^[0-9]{6}$/, {
    message: 'OTP must contain only numbers',
  })
  otp!: string;
}