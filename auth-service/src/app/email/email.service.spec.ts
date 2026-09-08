import nodemailer from 'nodemailer';

import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

describe('EmailService', () => {
  const sendMail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (nodemailer.createTransport as jest.Mock)
      .mockReturnValue({
        sendMail,
      });

    process.env.MAIL_ENABLED = 'true';
    process.env.MAIL_HOST = 'smtp.test.local';
    process.env.MAIL_PORT = '587';
    process.env.MAIL_SECURE = 'false';
    process.env.MAIL_USER = 'mailer-test-user';
    process.env.MAIL_PASSWORD = 'mailer-test-password';
    process.env.MAIL_FROM_NAME = 'Payflow';
    process.env.MAIL_FROM_EMAIL =
      'no-reply@payflow.test';

    sendMail.mockResolvedValue({
      messageId: 'test-message',
    });
  });

  afterEach(() => {
    delete process.env.MAIL_ENABLED;
    delete process.env.MAIL_HOST;
    delete process.env.MAIL_PORT;
    delete process.env.MAIL_SECURE;
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASSWORD;
    delete process.env.MAIL_FROM_NAME;
    delete process.env.MAIL_FROM_EMAIL;
  });

  it('creates the SMTP transporter from existing mail configuration', () => {
    new EmailService();

    expect(
      nodemailer.createTransport,
    ).toHaveBeenCalledWith({
      host: 'smtp.test.local',
      port: 587,
      secure: false,
      auth: {
        user: 'mailer-test-user',
        pass: 'mailer-test-password',
      },
    });
  });

  it('sends OTP email through direct nodemailer transport', async () => {
    const service = new EmailService();

    const result =
      await service.sendOtpEmail({
        email: 'recipient@payflow.test',
        firstName: 'Test',
        otp: '123456',
        expiresInMinutes: 5,
      });

    expect(sendMail).toHaveBeenCalledTimes(1);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from:
          '"Payflow" <no-reply@payflow.test>',
        to: 'recipient@payflow.test',
        subject: 'Your Payflow OTP',
      }),
    );

    expect(result).toEqual({
      delivery: 'email',
    });
  });

  it('does not send real email when mail is disabled', async () => {
    process.env.MAIL_ENABLED = 'false';

    const service = new EmailService();

    const result =
      await service.sendOtpEmail({
        email: 'recipient@payflow.test',
        firstName: 'Test',
        otp: '123456',
        expiresInMinutes: 5,
      });

    expect(sendMail).not.toHaveBeenCalled();

    expect(result).toEqual({
      delivery: 'console',
    });
  });

  it('sends password reset email through direct nodemailer transport', async () => {
    const service = new EmailService();

    const result =
      await service.sendResetPasswordEmail({
        email: 'recipient@payflow.test',
        firstName: 'Test',
        resetToken: 'reset-test-token',
      });

    expect(sendMail).toHaveBeenCalledTimes(1);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@payflow.test',
        subject:
          'Reset your Payflow password',
      }),
    );

    expect(result).toEqual({
      delivery: 'email',
    });
  });

  it('converts transport failure to ServiceUnavailableException', async () => {
    sendMail.mockRejectedValueOnce(
      new Error('controlled-test-failure'),
    );

    const service = new EmailService();

    await expect(
      service.sendOtpEmail({
        email: 'recipient@payflow.test',
        firstName: 'Test',
        otp: '123456',
        expiresInMinutes: 5,
      }),
    ).rejects.toMatchObject({
      message: 'Unable to send OTP email',
    });
  });
});