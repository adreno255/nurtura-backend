import { Injectable, BadRequestException } from '@nestjs/common';
import { OtpStore } from './interfaces/otp-record.interface';
import { SendOtpRequestDto } from './dto/send-otp-request.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { EmailService } from '../../email/email.service';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
    private readonly otpStore: OtpStore = {};
    private readonly OTP_EXPIRY_MINUTES = 15;
    private readonly OTP_LENGTH = 5;

    constructor(
        private readonly emailService: EmailService,
        private readonly logger: MyLoggerService,
    ) {}

    // Generate cryptographically secure OTP
    private generateOtp(): string {
        const digits = '0123456789';
        let otp = '';

        for (let i = 0; i < this.OTP_LENGTH; i++) {
            otp += digits[crypto.randomInt(0, digits.length)];
        }

        return otp;
    }

    // Generate expiry time string for email
    private getExpiryTimeString(): string {
        const expiryDate = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
        return expiryDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'Asia/Manila',
        });
    }

    async sendRegistrationOtp(dto: SendOtpRequestDto): Promise<void> {
        const { email } = dto;

        // Generate OTP on backend
        const code = this.generateOtp();
        const expiryTime = this.getExpiryTimeString();

        // Store OTP before sending email
        this.storeOtp(email, code, 'registration');

        try {
            await this.emailService.sendRegistrationOtp(email, code, expiryTime);
            this.logger.log(`Registration OTP sent successfully to ${email}`, 'OtpService');
        } catch (error) {
            // Remove stored OTP if email fails
            delete this.otpStore[email];
            this.logger.error(
                `Failed to send registration OTP to ${email}`,
                String(error),
                'OtpService',
            );
            throw new BadRequestException('Failed to send OTP email. Please try again.');
        }
    }

    async sendForgotPasswordOtp(dto: SendOtpRequestDto): Promise<void> {
        const { email } = dto;

        // Generate OTP on backend
        const code = this.generateOtp();
        const expiryTime = this.getExpiryTimeString();

        // Store OTP before sending email
        this.storeOtp(email, code, 'forgot-password');

        try {
            await this.emailService.sendForgotPasswordOtp(email, code, expiryTime);
            this.logger.log(`Forgot password OTP sent successfully to ${email}`, 'OtpService');
        } catch (error) {
            // Remove stored OTP if email fails
            delete this.otpStore[email];
            this.logger.error(
                `Failed to send forgot password OTP to ${email}`,
                String(error),
                'OtpService',
            );
            throw new BadRequestException('Failed to send password reset OTP. Please try again.');
        }
    }

    verifyOtp(dto: VerifyOtpDto): void {
        const { email, code, purpose } = dto;
        const record = this.otpStore[email];

        if (!record) {
            this.logger.warn(`OTP verification failed: No OTP found for ${email}`, 'OtpService');
            throw new BadRequestException('No OTP found for this email. Please request a new one.');
        }

        if (record.purpose !== purpose) {
            this.logger.warn(
                `OTP verification failed: Purpose mismatch for ${email}. Expected: ${record.purpose}, Got: ${purpose}`,
                'OtpService',
            );
            throw new BadRequestException(
                'Invalid OTP context. Please use the correct verification flow.',
            );
        }

        if (Date.now() > record.expiresAt) {
            delete this.otpStore[email];
            this.logger.warn(`OTP verification failed: Expired OTP for ${email}`, 'OtpService');
            throw new BadRequestException('OTP has expired. Please request a new one.');
        }

        if (record.code !== code) {
            this.logger.warn(`OTP verification failed: Invalid code for ${email}`, 'OtpService');
            throw new BadRequestException('Invalid OTP code. Please check and try again.');
        }

        // OTP is valid, remove it from store
        delete this.otpStore[email];
        this.logger.log(`OTP verified successfully for ${email}`, 'OtpService');
    }

    private storeOtp(
        email: string,
        code: string,
        purpose: 'registration' | 'forgot-password',
    ): void {
        this.otpStore[email] = {
            code: String(code),
            expiresAt: Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
            purpose,
        };
        this.logger.log(`OTP stored for ${email} with purpose: ${purpose}`, 'OtpService');
    }
}
