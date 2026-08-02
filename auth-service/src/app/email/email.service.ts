import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

import { buildOtpEmailTemplate } from './templates/otp.template';
import { buildResetPasswordEmailTemplate } from './templates/reset-password.template';
import { buildWelcomeEmailTemplate } from './templates/welcome.template';

export type EmailDeliveryResult = {
  delivery: 'email' | 'console';
};

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
  }): Promise<EmailDeliveryResult> {
    if (!this.isMailEnabled()) {
      this.logger.warn(
        [
          'MAIL_ENABLED=false',
          `Development OTP for ${input.email}: ${input.otp}`,
          `Expires in ${input.expiresInMinutes} minutes`,
        ].join(' | '),
      );

      return {
        delivery: 'console',
      };
    }

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

      return {
        delivery: 'email',
      };
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
  }): Promise<EmailDeliveryResult> {
    if (!this.isMailEnabled()) {
      this.logger.warn(
        `Development welcome email for ${input.email}`,
      );

      return {
        delivery: 'console',
      };
    }

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

      return {
        delivery: 'email',
      };
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${input.email}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new ServiceUnavailableException(
        'Unable to send welcome email',
      );
    }
  }

  async sendResetPasswordEmail(input: {
    email: string;
    firstName: string;
    resetToken: string;
  }): Promise<EmailDeliveryResult> {
    if (!this.isMailEnabled()) {
      this.logger.warn(
        [
          'MAIL_ENABLED=false',
          `Development password reset token for ${input.email}`,
          input.resetToken,
        ].join(' | '),
      );

      return {
        delivery: 'console',
      };
    }

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

      return {
        delivery: 'email',
      };
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

  private isMailEnabled(): boolean {
    return (
      String(
        process.env.MAIL_ENABLED ?? 'false',
      ).toLowerCase() === 'true'
    );
  }
}