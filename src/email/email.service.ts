import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import * as fs from 'fs';
import * as path from 'path';
import { getRegistrationOtpTemplate } from './templates/registration-otp.template';
import { getForgotPasswordOtpTemplate } from './templates/forgot-password-otp.template';
import { MyLoggerService } from '../my-logger/my-logger.service';

@Injectable()
export class EmailService {
    private readonly logoBase64: string;
    private readonly facebookBase64: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: MyLoggerService,
    ) {
        const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
        if (!apiKey) {
            this.logger.error('SENDGRID_API_KEY is not configured', '', 'EmailService');
            throw new Error('SENDGRID_API_KEY is not configured');
        }
        sgMail.setApiKey(apiKey);

        // Load images and convert to base64 once during initialization
        const assetsPath = path.join(process.cwd(), 'src', 'assets', 'email');

        try {
            this.logoBase64 = fs
                .readFileSync(path.join(assetsPath, 'Nurtura-Logo.png'))
                .toString('base64');

            this.facebookBase64 = fs
                .readFileSync(path.join(assetsPath, 'Facebook-icon.png'))
                .toString('base64');

            this.logger.log('Email assets loaded successfully', 'EmailService');
        } catch (error) {
            this.logger.error('Failed to load email assets', String(error), 'EmailService');
            throw new Error(
                'Failed to load email assets. Please ensure images exist in src/assets/email/',
            );
        }

        this.logger.log('SendGrid initialized successfully', 'EmailService');
    }

    async sendRegistrationOtp(email: string, code: string, expiryTime: string): Promise<void> {
        const fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL')!;
        const fromName = this.configService.get<string>('SENDGRID_FROM_NAME')!;

        const msg = {
            to: email,
            from: {
                email: fromEmail,
                name: fromName,
            },
            subject: 'OTP for your Nurtura authentication',
            html: getRegistrationOtpTemplate(code, expiryTime),
            attachments: [
                {
                    content: this.logoBase64,
                    filename: 'Nurtura-Logo.png',
                    type: 'image/png',
                    disposition: 'inline',
                    content_id: 'logo',
                },
                {
                    content: this.facebookBase64,
                    filename: 'Facebook-icon.png',
                    type: 'image/png',
                    disposition: 'inline',
                    content_id: 'facebook',
                },
            ],
        };

        try {
            await sgMail.send(msg);
            this.logger.log(`Registration OTP email sent to ${email}`, 'EmailService');
        } catch (error: any) {
            if (error instanceof Error) {
                const errorMessage = error.message;
                this.logger.error(
                    `Failed to send registration OTP to ${email}`,
                    String(errorMessage),
                    'EmailService',
                );
            }

            throw new InternalServerErrorException('Failed to send OTP email');
        }
    }

    async sendForgotPasswordOtp(email: string, code: string, expiryTime: string): Promise<void> {
        const fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL')!;
        const fromName = this.configService.get<string>('SENDGRID_FROM_NAME')!;

        const msg = {
            to: email,
            from: {
                email: fromEmail,
                name: fromName,
            },
            subject: 'Password Reset OTP for Nurtura',
            html: getForgotPasswordOtpTemplate(code, expiryTime),
            attachments: [
                {
                    content: this.logoBase64,
                    filename: 'Nurtura-Logo.png',
                    type: 'image/png',
                    disposition: 'inline',
                    content_id: 'logo',
                },
                {
                    content: this.facebookBase64,
                    filename: 'Facebook-icon.png',
                    type: 'image/png',
                    disposition: 'inline',
                    content_id: 'facebook',
                },
            ],
        };

        try {
            await sgMail.send(msg);
            this.logger.log(`Forgot password OTP email sent to ${email}`, 'EmailService');
        } catch (error: any) {
            if (error instanceof Error) {
                const errorMessage = error.message;
                this.logger.error(
                    `Failed to send forgot password OTP to ${email}`,
                    String(errorMessage),
                    'EmailService',
                );
            }
            throw new InternalServerErrorException('Failed to send password reset OTP email');
        }
    }
}
