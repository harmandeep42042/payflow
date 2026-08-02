import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  MailerModule,
} from '@nestjs-modules/mailer';

import { EmailController } from './email.controller';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [
    ConfigModule,

    MailerModule.forRootAsync({
      useFactory: () => {
        const port = Number(
          process.env.MAIL_PORT ?? 587,
        );

        const secure =
          String(
            process.env.MAIL_SECURE ?? 'false',
          ).toLowerCase() === 'true';

        return {
          transport: {
            host:
              process.env.MAIL_HOST ??
              'smtp.gmail.com',
            port,
            secure,
            auth: {
              user: process.env.MAIL_USER,
              pass: process.env.MAIL_PASSWORD,
            },
          },

          defaults: {
            from: `"${process.env.MAIL_FROM_NAME ?? 'Payflow'}" <${process.env.MAIL_FROM_EMAIL ?? process.env.MAIL_USER}>`,
          },
        };
      },
    }),
  ],

  controllers: [EmailController],

  providers: [EmailService],

  exports: [EmailService],
})
export class EmailModule {}
