import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CompleteMobileRegistrationDto {
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  @Matches(/^[a-f0-9]{64}$/, {
    message: 'Registration token is invalid',
  })
  registrationToken!: string;

  @IsEmail({}, {
    message: 'Please enter a valid email address',
  })
  email!: string;

  @IsString()
  @MinLength(2, {
    message: 'First name must contain at least 2 characters',
  })
  @MaxLength(50)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @IsString()
  @MinLength(8, {
    message: 'Password must contain at least 8 characters',
  })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/[0-9]/, {
    message: 'Password must contain at least one number',
  })
  password!: string;
}