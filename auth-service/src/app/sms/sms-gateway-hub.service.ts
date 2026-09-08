import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

type SmsGatewayHubResponse = {
  ErrorCode?: string;
  ErrorMessage?: string;
  JobId?: string;
};

@Injectable()
export class SmsGatewayHubService {
  private readonly logger = new Logger(SmsGatewayHubService.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    const apiKey = process.env.SMSGATEWAYHUB_API_KEY?.trim();
    const entityId = process.env.SMSGATEWAYHUB_ENTITY_ID?.trim();

    const senderId =
      process.env.SMSGATEWAYHUB_SENDER_ID?.trim() || 'GROWOT';

    const templateId =
      process.env.SMSGATEWAYHUB_TEMPLATE_ID?.trim() ||
      '1477178738797795443';

    const route =
      process.env.SMSGATEWAYHUB_ROUTE?.trim();

    if (!apiKey || !entityId) {
      throw new ServiceUnavailableException(
        'SMS gateway is not configured',
      );
    }

    const recipient = phone.replace(/^\+/, '');

    const message =
      `Your Growblic Chat Signup OTP: ${otp} ` +
      'Valid for 5 min. Do not share. - Growblic Private Limited';

    const url = new URL(
      'https://www.smsgatewayhub.com/api/mt/SendSMS',
    );

    url.searchParams.set('APIKey', apiKey);
    url.searchParams.set('senderid', senderId);
    url.searchParams.set('channel', 'OTP');
    url.searchParams.set('DCS', '0');
    url.searchParams.set('flashsms', '0');
    url.searchParams.set('number', recipient);
    url.searchParams.set('text', message);
    url.searchParams.set('EntityId', entityId);
    url.searchParams.set('dlttemplateid', templateId);

    if (route) {
      url.searchParams.set('route', route);
    }

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'GET',
      });
    } catch {
      throw new ServiceUnavailableException(
        'SMS gateway request failed',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'SMS gateway returned an HTTP error',
      );
    }

    let body: SmsGatewayHubResponse;

    try {
      body =
        (await response.json()) as SmsGatewayHubResponse;
    } catch {
      throw new ServiceUnavailableException(
        'SMS gateway returned an invalid response',
      );
    }

    if (body.ErrorCode !== '000') {
      this.logger.error(
        `SMS gateway rejected OTP delivery: ${
          body.ErrorMessage || 'unknown error'
        }`,
      );

      throw new ServiceUnavailableException(
        'Unable to send verification code',
      );
    }

    this.logger.log(
      `OTP SMS accepted by provider; jobId=${
        body.JobId ? 'present' : 'missing'
      }`,
    );
  }
}