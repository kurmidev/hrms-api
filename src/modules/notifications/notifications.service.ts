import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('email.host'),
      port: this.config.get<number>('email.port'),
      auth: {
        user: this.config.get<string>('email.user'),
        pass: this.config.get<string>('email.pass'),
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const from = this.config.get<string>('email.from');
    try {
      await this.transporter.sendMail({ from, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
      throw err;
    }
  }

  async sendSms(phone: string, message: string): Promise<void> {
    const nodeEnv = this.config.get<string>('nodeEnv');
    if (nodeEnv !== 'production') {
      this.logger.log(`[DEV SMS] → ${phone}: ${message}`);
      return;
    }
    try {
      const axios = (await import('axios')).default;
      await axios.get('https://www.fast2sms.com/dev/bulkV2', {
        params: {
          authorization: this.config.get('sms.fast2smsApiKey'),
          message,
          language: 'english',
          route: 'q',
          numbers: phone,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${phone}: ${err.message}`);
      throw err;
    }
  }
}
