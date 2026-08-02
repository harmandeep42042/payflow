import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
} from 'class-validator';

import { EmailService } from './email.service';

class TestEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;
}

@ApiTags('Email')
@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
  ) {}

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a development test email',
  })
  async sendTestEmail(
    @Body() dto: TestEmailDto,
  ) {
    await this.emailService.sendWelcomeEmail({
      email: dto.email,
      firstName: dto.firstName,
    });

    return {
      message: 'Test email processed',
      email: dto.email,
    };
  }
}
