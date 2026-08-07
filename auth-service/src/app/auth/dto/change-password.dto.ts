import {
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(8, {
    message:
      'New password must contain at least 8 characters',
  })
  @Matches(/[A-Z]/, {
    message:
      'New password must contain at least one uppercase letter',
  })
  @Matches(/[a-z]/, {
    message:
      'New password must contain at least one lowercase letter',
  })
  @Matches(/[0-9]/, {
    message:
      'New password must contain at least one number',
  })
  newPassword!: string;
}