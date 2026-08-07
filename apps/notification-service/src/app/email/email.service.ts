import {
  Injectable,
  Logger,
} from '@nestjs/common';

import nodemailer, {
  Transporter,
} from 'nodemailer';

import {
  payflowConfig,
} from '@payflow/shared-config';

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class EmailService {
  private readonly logger =
    new Logger(EmailService.name);

  private readonly transporter:
    Transporter;

  private readonly fromAddress =
    payflowConfig.email.from;

  private readonly previewMode:
    boolean;

  constructor() {
    const smtpHost =
      payflowConfig.email.host.trim();

    const smtpUser =
      payflowConfig.email.user.trim();

    const smtpPassword =
      payflowConfig.email.password.trim();

    if (
      !payflowConfig.email.previewMode &&
      smtpHost &&
      smtpUser &&
      smtpPassword
    ) {
      this.previewMode = false;

      this.transporter =
        nodemailer.createTransport({
          host: smtpHost,

          port:
            payflowConfig.email.port,

          secure:
            payflowConfig.email.secure,

          auth: {
            user: smtpUser,
            pass: smtpPassword,
          },
        });

      this.logger.log(
        `SMTP transport configured for ${smtpHost}`,
      );
    } else {
      this.previewMode = true;

      this.transporter =
        nodemailer.createTransport({
          jsonTransport: true,
        });

      this.logger.warn(
        'SMTP credentials are missing. Email preview mode is active.',
      );
    }
  }

  async sendEmail(
    input: SendEmailInput,
  ): Promise<void> {
    if (!input.to?.trim()) {
      throw new Error(
        'Email recipient is missing',
      );
    }

    const testRecipient =
      payflowConfig.email.testRecipient
        .trim();

    const actualRecipient =
      testRecipient || input.to.trim();

    if (testRecipient) {
      this.logger.warn(
        `Test mode redirect: ${input.to} -> ${actualRecipient}`,
      );
    }

    const result =
      await this.transporter.sendMail({
        from:
          this.fromAddress,

        to:
          actualRecipient,

        subject:
          input.subject,

        text:
          input.text,

        html:
          input.html,
      });

    if (this.previewMode) {
      this.logger.log(
        `Email preview generated for ${actualRecipient}: ${JSON.stringify(
          result,
        )}`,
      );

      return;
    }

    this.logger.log(
      `Email sent successfully to ${actualRecipient}`,
    );
  }

  async sendDepositCompleted(
    input: {
      email: string;
      firstName?: string;
      amount: string;
      currency: string;
      reference?: string;
      walletId?: string;
    },
  ): Promise<void> {
    const name =
      input.firstName?.trim() ||
      'Customer';

    const subject =
      'Deposit completed successfully';

    const text = [
      `Hello ${name},`,
      '',
      `Your deposit of ${input.currency} ${input.amount} was completed successfully.`,
      `Reference: ${input.reference ?? 'Not available'}`,
      `Wallet: ${input.walletId ?? 'Not available'}`,
      '',
      'Thank you for using Payflow.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Deposit completed</h2>
        <p>Hello ${this.escapeHtml(name)},</p>
        <p>
          Your deposit of
          <strong>
            ${this.escapeHtml(input.currency)}
            ${this.escapeHtml(input.amount)}
          </strong>
          was completed successfully.
        </p>
        <p>
          <strong>Reference:</strong>
          ${this.escapeHtml(
            input.reference ??
              'Not available',
          )}
        </p>
        <p>
          <strong>Wallet:</strong>
          ${this.escapeHtml(
            input.walletId ??
              'Not available',
          )}
        </p>
        <p>Thank you for using Payflow.</p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }

  async sendWithdrawalCompleted(
    input: {
      email: string;
      firstName?: string;
      amount: string;
      currency: string;
      reference?: string;
      walletId?: string;
    },
  ): Promise<void> {
    const name =
      input.firstName?.trim() ||
      'Customer';

    const subject =
      'Withdrawal completed successfully';

    const text = [
      `Hello ${name},`,
      '',
      `Your withdrawal of ${input.currency} ${input.amount} was completed successfully.`,
      `Reference: ${input.reference ?? 'Not available'}`,
      `Wallet: ${input.walletId ?? 'Not available'}`,
      '',
      'Thank you for using Payflow.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Withdrawal completed</h2>
        <p>Hello ${this.escapeHtml(name)},</p>
        <p>
          Your withdrawal of
          <strong>
            ${this.escapeHtml(input.currency)}
            ${this.escapeHtml(input.amount)}
          </strong>
          was completed successfully.
        </p>
        <p>
          <strong>Reference:</strong>
          ${this.escapeHtml(
            input.reference ??
              'Not available',
          )}
        </p>
        <p>
          <strong>Wallet:</strong>
          ${this.escapeHtml(
            input.walletId ??
              'Not available',
          )}
        </p>
        <p>Thank you for using Payflow.</p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }

  async sendTransferSent(
    input: {
      email: string;
      firstName?: string;
      amount: string;
      currency: string;
      receiverName?: string;
      description?: string | null;
      transferId?: string;
    },
  ): Promise<void> {
    const name =
      input.firstName?.trim() ||
      'Customer';

    const receiver =
      input.receiverName?.trim() ||
      'Payflow customer';

    const subject =
      'Money sent successfully';

    const text = [
      `Hello ${name},`,
      '',
      `You sent ${input.currency} ${input.amount} to ${receiver}.`,
      `Transfer ID: ${input.transferId ?? 'Not available'}`,
      `Description: ${input.description ?? 'Not provided'}`,
      '',
      'Thank you for using Payflow.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Money sent successfully</h2>
        <p>Hello ${this.escapeHtml(name)},</p>
        <p>
          You sent
          <strong>
            ${this.escapeHtml(input.currency)}
            ${this.escapeHtml(input.amount)}
          </strong>
          to
          <strong>
            ${this.escapeHtml(receiver)}
          </strong>.
        </p>
        <p>
          <strong>Transfer ID:</strong>
          ${this.escapeHtml(
            input.transferId ??
              'Not available',
          )}
        </p>
        <p>
          <strong>Description:</strong>
          ${this.escapeHtml(
            input.description ??
              'Not provided',
          )}
        </p>
        <p>Thank you for using Payflow.</p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }

  async sendTransferReceived(
    input: {
      email: string;
      firstName?: string;
      amount: string;
      currency: string;
      senderName?: string;
      description?: string | null;
      transferId?: string;
    },
  ): Promise<void> {
    const name =
      input.firstName?.trim() ||
      'Customer';

    const sender =
      input.senderName?.trim() ||
      'Payflow customer';

    const subject =
      'Money received successfully';

    const text = [
      `Hello ${name},`,
      '',
      `You received ${input.currency} ${input.amount} from ${sender}.`,
      `Transfer ID: ${input.transferId ?? 'Not available'}`,
      `Description: ${input.description ?? 'Not provided'}`,
      '',
      'Thank you for using Payflow.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Money received successfully</h2>
        <p>Hello ${this.escapeHtml(name)},</p>
        <p>
          You received
          <strong>
            ${this.escapeHtml(input.currency)}
            ${this.escapeHtml(input.amount)}
          </strong>
          from
          <strong>
            ${this.escapeHtml(sender)}
          </strong>.
        </p>
        <p>
          <strong>Transfer ID:</strong>
          ${this.escapeHtml(
            input.transferId ??
              'Not available',
          )}
        </p>
        <p>
          <strong>Description:</strong>
          ${this.escapeHtml(
            input.description ??
              'Not provided',
          )}
        </p>
        <p>Thank you for using Payflow.</p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }

  private escapeHtml(
    value: string,
  ): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}