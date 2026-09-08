import {
  IsString,
  Matches,
} from 'class-validator';

export class RequestMobileOtpDto {
  @IsString()
  @Matches(/^(\+91|91)?[6-9][0-9]{9}$/, {
    message: 'Please enter a valid Indian mobile number',
  })
  phone!: string;
}