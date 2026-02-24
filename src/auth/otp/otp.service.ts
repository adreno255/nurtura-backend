import {
    Injectable,
    BadRequestException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { OtpStore } from './interfaces/otp-record.interface';
import { SendOtpRequestDto } from './dto/send-otp-request.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { EmailService } from '../../email/email.service';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { FirebaseService } from '../../firebase/firebase.service';
import { verifyOtpResponse } from './interfaces/otp-response.interface';

@Injectable()
export class OtpService {
    private readonly otpStore: OtpStore = {};
    private readonly OTP_EXPIRY_MINUTES = 15;
    private readonly OTP_LENGTH = 5;

    constructor(
        private readonly emailService: EmailService,
        private readonly databaseService: DatabaseService,
        private readonly firebaseService: FirebaseService,
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
            throw new InternalServerErrorException('Failed to send registration OTP email');
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
            throw new InternalServerErrorException('Failed to send forgot password OTP email');
        }
    }

    async sendPasswordResetOtp(dto: SendOtpRequestDto): Promise<void> {
        const { email } = dto;

        // Generate OTP on backend
        const code = this.generateOtp();
        const expiryTime = this.getExpiryTimeString();

        // Store OTP before sending email
        this.storeOtp(email, code, 'password-reset');

        try {
            await this.emailService.sendPasswordResetOtp(email, code, expiryTime);
            this.logger.log(`Password reset OTP sent successfully to ${email}`, 'OtpService');
        } catch (error) {
            // Remove stored OTP if email fails
            delete this.otpStore[email];
            this.logger.error(
                `Failed to send password reset OTP to ${email}`,
                String(error),
                'OtpService',
            );
            throw new InternalServerErrorException('Failed to send password reset OTP email');
        }
    }

    async sendEmailResetOtp(dto: SendOtpRequestDto): Promise<void> {
        const { email } = dto;

        // Generate OTP on backend
        const code = this.generateOtp();
        const expiryTime = this.getExpiryTimeString();

        // Store OTP before sending email
        this.storeOtp(email, code, 'email-reset');

        try {
            await this.emailService.sendEmailResetOtp(email, code, expiryTime);
            this.logger.log(`Email reset OTP sent successfully to ${email}`, 'OtpService');
        } catch (error) {
            // Remove stored OTP if email fails
            delete this.otpStore[email];
            this.logger.error(
                `Failed to send email reset OTP to ${email}`,
                String(error),
                'OtpService',
            );
            throw new InternalServerErrorException('Failed to send email reset OTP email');
        }
    }

    async verifyOtp(dto: VerifyOtpDto): Promise<verifyOtpResponse> {
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

        if (purpose === 'forgot-password') {
            const user = await this.databaseService.user.findUnique({
                where: { email },
                select: { firebaseUid: true },
            });

            if (!user) {
                this.logger.warn(
                    `OTP verification failed: User not found for ${email}`,
                    'OtpService',
                );
                throw new NotFoundException('User not found');
            }

            try {
                const customToken = await this.firebaseService
                    .getAuth()
                    .createCustomToken(user.firebaseUid);

                delete this.otpStore[email];
                this.logger.log(
                    `OTP verified successfully for ${email} with purpose of forgot-password`,
                    'OtpService',
                );
                return {
                    message: 'OTP verified successfully.',
                    loginToken: customToken,
                };
            } catch (error) {
                this.logger.error(
                    `Failed to create login token for ${email}`,
                    error instanceof Error ? error.message : String(error),
                    'OtpService',
                );

                throw new InternalServerErrorException('Failed to create login token for email');
            }
        }

        // OTP is valid, remove it from store
        delete this.otpStore[email];
        this.logger.log(
            `OTP verified successfully for ${email} with purpose of ${purpose}`,
            'OtpService',
        );
        return {
            message: 'OTP verified successfully.',
        };
    }

    private storeOtp(
        email: string,
        code: string,
        purpose: 'registration' | 'forgot-password' | 'password-reset' | 'email-reset',
    ): void {
        this.otpStore[email] = {
            code: String(code),
            expiresAt: Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
            purpose,
        };
        this.logger.log(`OTP stored for ${email} with purpose: ${purpose}`, 'OtpService');
    }
}
