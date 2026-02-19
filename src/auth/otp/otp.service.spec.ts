import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { OtpService } from './otp.service';
import { EmailService } from '../../email/email.service';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import { type VerifyOtpDto } from './dto/verify-otp.dto';
import { createMockEmailService, createMockLogger } from '../../../test/mocks';
import { expectedOtpErrors, testEmails, validSendOtpDto } from '../../../test/fixtures';

describe('OtpService', () => {
    let service: OtpService;

    const mockEmailService = createMockEmailService();

    const mockLoggerService = createMockLogger();

    const testEmail = testEmails.valid;
    const email1 = testEmails.valid;
    const email2 = testEmails.alternative;
    const dto = validSendOtpDto;

    beforeEach(async () => {
        jest.clearAllMocks();
        // Reset Date.now to actual implementation
        jest.spyOn(Date, 'now').mockRestore();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OtpService,
                {
                    provide: EmailService,
                    useValue: mockEmailService,
                },
                {
                    provide: MyLoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        service = module.get<OtpService>(OtpService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('sendRegistrationOtp', () => {
        beforeEach(() => {
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
        });

        it('should generate a 5-digit OTP', async () => {
            await service.sendRegistrationOtp(dto);

            expect(mockEmailService.sendRegistrationOtp).toHaveBeenCalled();
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];
            expect(code).toMatch(/^\d{5}$/);
        });

        it('should send OTP via EmailService', async () => {
            await service.sendRegistrationOtp(dto);

            expect(mockEmailService.sendRegistrationOtp).toHaveBeenCalledWith(
                testEmail,
                expect.any(String),
                expect.any(String),
            );
        });

        it('should generate unique OTPs', async () => {
            const codes = new Set<string>();

            for (let i = 0; i < 10; i++) {
                await service.sendRegistrationOtp(dto);
                const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[i] as string[];
                codes.add(code);
            }

            // Should have multiple unique codes (very unlikely to have duplicates)
            expect(codes.size).toBeGreaterThan(1);
        });

        it('should include expiry time in email', async () => {
            await service.sendRegistrationOtp(dto);

            const [, , expiryTime] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];
            expect(expiryTime).toBeDefined();
            expect(typeof expiryTime).toBe('string');
            expect(expiryTime).toMatch(/\d{1,2}:\d{2}/); // Time format like "10:30"
        });

        it('should store OTP with 15-minute expiry', async () => {
            const now = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            await service.sendRegistrationOtp(dto);

            // Try to verify immediately - should work
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];
            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'registration',
            };

            expect(() => service.verifyOtp(verifyDto)).not.toThrow();
        });

        it('should store OTP with purpose "registration"', async () => {
            await service.sendRegistrationOtp(dto);

            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];
            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'registration',
            };

            expect(() => service.verifyOtp(verifyDto)).not.toThrow();
        });

        it('should log success message', async () => {
            await service.sendRegistrationOtp(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Registration OTP sent successfully to ${testEmail}`,
                'OtpService',
            );
        });

        it('should throw InternalServerErrorException if email fails', async () => {
            const emailError = new Error('Email service error');
            mockEmailService.sendRegistrationOtp.mockRejectedValue(emailError);

            await expect(service.sendRegistrationOtp(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.sendRegistrationOtp(dto)).rejects.toThrow(
                'Failed to send registration OTP email',
            );
        });

        it('should log error if email fails', async () => {
            const emailError = new Error('Email service error');
            mockEmailService.sendRegistrationOtp.mockRejectedValue(emailError);

            await expect(service.sendRegistrationOtp(dto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to send registration OTP to ${testEmail}`,
                'Error: Email service error',
                'OtpService',
            );
        });

        it('should remove stored OTP if email fails', async () => {
            mockEmailService.sendRegistrationOtp.mockRejectedValue(new Error('Email failed'));

            await expect(service.sendRegistrationOtp(dto)).rejects.toThrow();

            // Try to verify - should fail with "No OTP found"
            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code: '12345',
                purpose: 'registration',
            };

            expect(() => service.verifyOtp(verifyDto)).toThrow(expectedOtpErrors.notFound);
        });

        it('should overwrite existing OTP when sending new one', async () => {
            await service.sendRegistrationOtp(dto);
            const [, firstCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            await service.sendRegistrationOtp(dto);
            const [, secondCode] = mockEmailService.sendRegistrationOtp.mock.calls[1] as string[];

            // Old OTP should no longer work
            const oldOtpDto: VerifyOtpDto = {
                email: testEmail,
                code: firstCode,
                purpose: 'registration',
            };
            expect(() => service.verifyOtp(oldOtpDto)).toThrow(expectedOtpErrors.invalid);

            // New OTP should work
            const newOtpDto: VerifyOtpDto = {
                email: testEmail,
                code: secondCode,
                purpose: 'registration',
            };
            expect(() => service.verifyOtp(newOtpDto)).not.toThrow();
        });
    });

    describe('sendPasswordResetOtp', () => {
        beforeEach(() => {
            mockEmailService.sendPasswordResetOtp.mockResolvedValue(undefined);
        });

        it('should generate a 5-digit OTP', async () => {
            await service.sendPasswordResetOtp(dto);

            expect(mockEmailService.sendPasswordResetOtp).toHaveBeenCalled();
            const [, code] = mockEmailService.sendPasswordResetOtp.mock.calls[0] as string[];
            expect(code).toMatch(/^\d{5}$/);
        });

        it('should send OTP via EmailService', async () => {
            await service.sendPasswordResetOtp(dto);

            expect(mockEmailService.sendPasswordResetOtp).toHaveBeenCalledWith(
                testEmail,
                expect.any(String),
                expect.any(String),
            );
        });

        it('should include expiry time in email', async () => {
            await service.sendPasswordResetOtp(dto);

            const [, , expiryTime] = mockEmailService.sendPasswordResetOtp.mock
                .calls[0] as string[];
            expect(expiryTime).toBeDefined();
            expect(typeof expiryTime).toBe('string');
            expect(expiryTime).toMatch(/\d{1,2}:\d{2}/);
        });

        it('should store OTP with purpose "password-reset"', async () => {
            await service.sendPasswordResetOtp(dto);

            const [, code] = mockEmailService.sendPasswordResetOtp.mock.calls[0] as string[];
            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'password-reset',
            };

            expect(() => service.verifyOtp(verifyDto)).not.toThrow();
        });

        it('should log success message', async () => {
            await service.sendPasswordResetOtp(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Password reset OTP sent successfully to ${testEmail}`,
                'OtpService',
            );
        });

        it('should throw InternalServerErrorException if email fails', async () => {
            const emailError = new Error('Email service error');
            mockEmailService.sendPasswordResetOtp.mockRejectedValue(emailError);

            await expect(service.sendPasswordResetOtp(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.sendPasswordResetOtp(dto)).rejects.toThrow(
                'Failed to send password reset OTP email',
            );
        });

        it('should log error if email fails', async () => {
            const emailError = new Error('Email service error');
            mockEmailService.sendPasswordResetOtp.mockRejectedValueOnce(emailError);

            await expect(service.sendPasswordResetOtp(dto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to send password reset OTP to ${testEmail}`,
                'Error: Email service error',
                'OtpService',
            );
        });

        it('should remove stored OTP if email fails', async () => {
            mockEmailService.sendPasswordResetOtp.mockRejectedValueOnce(new Error('Email failed'));

            await expect(service.sendPasswordResetOtp(dto)).rejects.toThrow();

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code: '12345',
                purpose: 'password-reset',
            };

            expect(() => service.verifyOtp(verifyDto)).toThrow(expectedOtpErrors.notFound);
        });
    });

    describe('sendEmailResetOtp', () => {
        beforeEach(() => {
            mockEmailService.sendEmailResetOtp.mockResolvedValue(undefined);
        });

        it('should generate a 5-digit OTP', async () => {
            await service.sendEmailResetOtp(dto);

            expect(mockEmailService.sendEmailResetOtp).toHaveBeenCalled();
            const [, code] = mockEmailService.sendEmailResetOtp.mock.calls[0] as string[];
            expect(code).toMatch(/^\d{5}$/);
        });

        it('should send OTP via EmailService', async () => {
            await service.sendEmailResetOtp(dto);

            expect(mockEmailService.sendEmailResetOtp).toHaveBeenCalledWith(
                testEmail,
                expect.any(String),
                expect.any(String),
            );
        });

        it('should include expiry time in email', async () => {
            await service.sendEmailResetOtp(dto);

            const [, , expiryTime] = mockEmailService.sendEmailResetOtp.mock.calls[0] as string[];
            expect(expiryTime).toBeDefined();
            expect(typeof expiryTime).toBe('string');
            expect(expiryTime).toMatch(/\d{1,2}:\d{2}/);
        });

        it('should store OTP with purpose "email-reset"', async () => {
            await service.sendEmailResetOtp(dto);
            const [, code] = mockEmailService.sendEmailResetOtp.mock.calls[0] as string[];
            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'email-reset',
            };

            expect(() => service.verifyOtp(verifyDto)).not.toThrow();
        });

        it('should log success message', async () => {
            await service.sendEmailResetOtp(dto);
            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Email reset OTP sent successfully to ${testEmail}`,
                'OtpService',
            );
        });

        it('should throw InternalServerErrorException if email fails', async () => {
            const emailError = new Error('Email service error');
            mockEmailService.sendEmailResetOtp.mockRejectedValue(emailError);

            await expect(service.sendEmailResetOtp(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.sendEmailResetOtp(dto)).rejects.toThrow(
                'Failed to send email reset OTP email',
            );
        });

        it('should log error if email fails', async () => {
            const emailError = new Error('Email service error');
            mockEmailService.sendEmailResetOtp.mockRejectedValueOnce(emailError);

            await expect(service.sendEmailResetOtp(dto)).rejects.toThrow();
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to send email reset OTP to ${testEmail}`,
                'Error: Email service error',
                'OtpService',
            );
        });

        it('should remove stored OTP if email fails', async () => {
            mockEmailService.sendEmailResetOtp.mockRejectedValueOnce(new Error('Email failed'));

            await expect(service.sendEmailResetOtp(dto)).rejects.toThrow();

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code: '12345',
                purpose: 'email-reset',
            };
            expect(() => service.verifyOtp(verifyDto)).toThrow(expectedOtpErrors.notFound);
        });
    });

    describe('verifyOtp', () => {
        const testEmail = 'test@example.com';

        beforeEach(() => {
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
        });

        it('should verify correct OTP successfully', async () => {
            await service.sendRegistrationOtp({ email: testEmail });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'registration',
            };

            expect(() => service.verifyOtp(verifyDto)).not.toThrow();
        });

        it('should verify correct OTP for email-reset purpose', async () => {
            await service.sendEmailResetOtp({ email: testEmail });
            const [, code] = mockEmailService.sendEmailResetOtp.mock.calls[0] as string[];

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'email-reset',
            };

            expect(() => service.verifyOtp(verifyDto)).not.toThrow();
        });

        it('should throw error if OTP not found', () => {
            const verifyDto: VerifyOtpDto = {
                email: 'nonexistent@example.com',
                code: '12345',
                purpose: 'registration',
            };

            expect(() => service.verifyOtp(verifyDto)).toThrow(BadRequestException);
            expect(() => service.verifyOtp(verifyDto)).toThrow(expectedOtpErrors.notFound);
        });

        it('should throw error if OTP code is incorrect', async () => {
            await service.sendRegistrationOtp({ email: testEmail });

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code: '00000',
                purpose: 'registration',
            };

            expect(() => service.verifyOtp(verifyDto)).toThrow(BadRequestException);
            expect(() => service.verifyOtp(verifyDto)).toThrow(expectedOtpErrors.invalid);
        });

        it('should throw error if purpose mismatches', async () => {
            await service.sendRegistrationOtp({ email: testEmail });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'password-reset', // Wrong purpose
            };

            expect(() => service.verifyOtp(verifyDto)).toThrow(BadRequestException);
            expect(() => service.verifyOtp(verifyDto)).toThrow(expectedOtpErrors.purposeMismatch);
        });

        it('should throw error if OTP has expired', async () => {
            const now = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            await service.sendRegistrationOtp({ email: testEmail });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            // Fast-forward time by 16 minutes (1 minute past expiry)
            jest.spyOn(Date, 'now').mockReturnValue(now + 16 * 60 * 1000);

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'registration',
            };

            let thrownError: unknown = null;
            try {
                service.verifyOtp(verifyDto);
            } catch (e) {
                thrownError = e as Error;
            }

            expect(thrownError).not.toBeNull();
            expect(thrownError).toBeInstanceOf(BadRequestException);
            expect((thrownError as BadRequestException).message).toBe(expectedOtpErrors.expired);
        });

        it('should remove OTP after successful verification', async () => {
            await service.sendRegistrationOtp({ email: testEmail });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'registration',
            };

            service.verifyOtp(verifyDto);

            // Trying to verify again should fail
            expect(() => service.verifyOtp(verifyDto)).toThrow(expectedOtpErrors.notFound);
        });

        it('should remove expired OTP when verifying', async () => {
            const now = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            await service.sendRegistrationOtp({ email: testEmail });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            // Fast-forward time past expiry
            jest.spyOn(Date, 'now').mockReturnValue(now + 16 * 60 * 1000);

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'registration',
            };

            expect(() => service.verifyOtp(verifyDto)).toThrow(expectedOtpErrors.expired);

            // OTP should be removed, trying again should show "not found"
            expect(() => service.verifyOtp(verifyDto)).toThrow(expectedOtpErrors.notFound);
        });

        it('should log success message on verification', async () => {
            await service.sendRegistrationOtp({ email: testEmail });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'registration',
            };

            service.verifyOtp(verifyDto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `OTP verified successfully for ${testEmail}`,
                'OtpService',
            );
        });

        it('should log warning on verification failure', () => {
            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code: '12345',
                purpose: 'registration',
            };

            expect(() => service.verifyOtp(verifyDto)).toThrow();

            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                expect.stringContaining('OTP verification failed'),
                'OtpService',
            );
        });
    });

    describe('OTP generation', () => {
        beforeEach(() => {
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
        });

        it('should generate numeric codes only', async () => {
            for (let i = 0; i < 20; i++) {
                await service.sendRegistrationOtp({ email: `test${i}@example.com` });
                const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[i] as string[];
                expect(code).toMatch(/^\d+$/);
            }
        });

        it('should generate exactly 5 digits', async () => {
            for (let i = 0; i < 20; i++) {
                await service.sendRegistrationOtp({ email: `test${i}@example.com` });
                const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[i] as string[];
                expect(code.length).toBe(5);
            }
        });

        it('should generate valid integer codes', async () => {
            await service.sendRegistrationOtp({ email: 'test@example.com' });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            const numericValue = parseInt(code, 10);
            expect(numericValue).toBeGreaterThanOrEqual(0);
            expect(numericValue).toBeLessThan(100000);
        });
    });

    describe('error handling edge cases', () => {
        beforeEach(() => {
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
        });

        it('should handle non-Error objects in email failure', async () => {
            mockEmailService.sendRegistrationOtp.mockRejectedValueOnce('String error');

            await expect(
                service.sendRegistrationOtp({ email: 'test@example.com' }),
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('should store OTP with correct expiry calculation', async () => {
            const now = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            await service.sendRegistrationOtp({ email: 'test@example.com' });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            // Just before expiry (14:59) - should work
            jest.spyOn(Date, 'now').mockReturnValue(now + 14 * 60 * 1000 + 59 * 1000);
            expect(() =>
                service.verifyOtp({
                    email: 'test@example.com',
                    code,
                    purpose: 'registration',
                }),
            ).not.toThrow();
        });
    });

    describe('concurrent OTP handling', () => {
        beforeEach(() => {
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
            mockEmailService.sendPasswordResetOtp.mockResolvedValue(undefined);
        });

        it('should handle multiple OTPs for different emails', async () => {
            await service.sendRegistrationOtp({ email: email1 });
            await service.sendRegistrationOtp({ email: email2 });

            const [, code1] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];
            const [, code2] = mockEmailService.sendRegistrationOtp.mock.calls[1] as string[];

            // Both OTPs should be independently verifiable
            expect(() =>
                service.verifyOtp({ email: email1, code: code1, purpose: 'registration' }),
            ).not.toThrow();

            expect(() =>
                service.verifyOtp({ email: email2, code: code2, purpose: 'registration' }),
            ).not.toThrow();
        });

        it('should isolate OTPs by email address', async () => {
            await service.sendRegistrationOtp({ email: email1 });
            const [, code1] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            await service.sendRegistrationOtp({ email: email2 });

            // Using email1's code with email2 should fail
            expect(() =>
                service.verifyOtp({ email: email2, code: code1, purpose: 'registration' }),
            ).toThrow();
        });
    });
});
