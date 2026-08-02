import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

import { buildOtpEmailTemplate } from './templates/otp.template';
import { buildResetPasswordEmailTemplate } from './templates/reset-password.template';
import { buildWelcomeEmailTemplate } from './templates/welcome.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly mailerService: MailerService,
  ) {}

  async sendOtpEmail(input: {
    email: string;
    firstName: string;
    otp: string;
    expiresInMinutes: number;
  }): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: input.email,
        subject: 'Your Payflow OTP',
        html: buildOtpEmailTemplate(
          input.firstName,
          input.otp,
          input.expiresInMinutes,
        ),
      });

      this.logger.log(
        `OTP email sent to ${input.email}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send OTP email to ${input.email}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new ServiceUnavailableException(
        'Unable to send OTP email',
      );
    }
  }

  async sendWelcomeEmail(input: {
    email: string;
    firstName: string;
  }): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: input.email,
        subject: 'Welcome to Payflow',
        html: buildWelcomeEmailTemplate(
          input.firstName,
        ),
      });

      this.logger.log(
        `Welcome email sent to ${input.email}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${input.email}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }

  async sendResetPasswordEmail(input: {
    email: string;
    firstName: string;
    resetToken: string;
  }): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: input.email,
        subject: 'Reset your Payflow password',
        html: buildResetPasswordEmailTemplate(
          input.firstName,
          input.resetToken,
        ),
      });

      this.logger.log(
        `Password reset email sent to ${input.email}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${input.email}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new ServiceUnavailableException(
        'Unable to send password reset email',
      );
    }
  }
}
