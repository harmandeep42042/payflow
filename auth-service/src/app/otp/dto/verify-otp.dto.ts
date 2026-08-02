import {
  IsEmail,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class VerifyOtpDto {
  @IsEmail(
    {},
    {
      message: 'Please enter a valid email address',
    },
  )
  email!: string;

  @IsString()
  @Length(6, 6, {
    message: 'OTP must contain exactly 6 digits',
  })
  @Matches(/^[0-9]{6}$/, {
    message: 'OTP must contain only numbers',
  })
  otp!: string;
}
