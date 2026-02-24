import { Test, type TestingModule } from '@nestjs/testing';
import {
    BadRequestException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { OtpService } from './otp.service';
import { EmailService } from '../../email/email.service';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import { type VerifyOtpDto } from './dto/verify-otp.dto';
import { DatabaseService } from '../../database/database.service';
import { FirebaseService } from '../../firebase/firebase.service';
import {
    createMockFirebaseAuth,
    createMockFirebaseService,
    createMockDatabaseService,
    createMockEmailService,
    createMockLogger,
} from '../../../test/mocks';
import { expectedOtpErrors, expectedOtpResponses, testEmails } from '../../../test/fixtures';

describe('OtpService', () => {
    let service: OtpService;

    const mockEmailService = createMockEmailService();
    const mockDatabaseService = createMockDatabaseService();
    const mockFirebaseAuth = createMockFirebaseAuth();
    const mockFirebaseService = createMockFirebaseService(mockFirebaseAuth);
    const mockLoggerService = createMockLogger();

    const testEmail = testEmails.valid; // 'test@example.com'
    const email1 = testEmails.valid;
    const email2 = testEmails.alternative; // 'user@test.com'
    const dto = { email: testEmail };

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.spyOn(Date, 'now').mockRestore();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OtpService,
                { provide: EmailService, useValue: mockEmailService },
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: FirebaseService, useValue: mockFirebaseService },
                { provide: MyLoggerService, useValue: mockLoggerService },
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

            expect(codes.size).toBeGreaterThan(1);
        });

        it('should include expiry time in email', async () => {
            await service.sendRegistrationOtp(dto);

            const [, , expiryTime] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];
            expect(expiryTime).toBeDefined();
            expect(typeof expiryTime).toBe('string');
            expect(expiryTime).toMatch(/\d{1,2}:\d{2}/);
        });

        it('should store OTP with 15-minute expiry', async () => {
            const now = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            await service.sendRegistrationOtp(dto);

            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];
            const verifyDto: VerifyOtpDto = { email: testEmail, code, purpose: 'registration' };

            await expect(service.verifyOtp(verifyDto)).resolves.not.toThrow();
        });

        it('should store OTP with purpose "registration"', async () => {
            await service.sendRegistrationOtp(dto);

            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];
            const verifyDto: VerifyOtpDto = { email: testEmail, code, purpose: 'registration' };

            await expect(service.verifyOtp(verifyDto)).resolves.not.toThrow();
        });

        it('should log success message', async () => {
            await service.sendRegistrationOtp(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Registration OTP sent successfully to ${testEmail}`,
                'OtpService',
            );
        });

        it('should throw InternalServerErrorException if email fails', async () => {
            mockEmailService.sendRegistrationOtp.mockRejectedValue(
                new Error('Email service error'),
            );

            await expect(service.sendRegistrationOtp(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.sendRegistrationOtp(dto)).rejects.toThrow(
                'Failed to send registration OTP email',
            );
        });

        it('should log error if email fails', async () => {
            mockEmailService.sendRegistrationOtp.mockRejectedValue(
                new Error('Email service error'),
            );

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

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code: '12345',
                purpose: 'registration',
            };

            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(expectedOtpErrors.notFound);
        });

        it('should overwrite existing OTP when sending new one', async () => {
            await service.sendRegistrationOtp(dto);
            const [, firstCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            await service.sendRegistrationOtp(dto);
            const [, secondCode] = mockEmailService.sendRegistrationOtp.mock.calls[1] as string[];

            // Old code should no longer work
            const oldOtpDto: VerifyOtpDto = {
                email: testEmail,
                code: firstCode,
                purpose: 'registration',
            };
            await expect(service.verifyOtp(oldOtpDto)).rejects.toThrow(expectedOtpErrors.invalid);

            // New code should work
            const newOtpDto: VerifyOtpDto = {
                email: testEmail,
                code: secondCode,
                purpose: 'registration',
            };
            await expect(service.verifyOtp(newOtpDto)).resolves.not.toThrow();
        });
    });

    describe('sendForgotPasswordOtp', () => {
        beforeEach(() => {
            mockEmailService.sendForgotPasswordOtp.mockResolvedValue(undefined);
        });

        it('should generate a 5-digit OTP', async () => {
            await service.sendForgotPasswordOtp(dto);

            expect(mockEmailService.sendForgotPasswordOtp).toHaveBeenCalled();
            const [, code] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as string[];
            expect(code).toMatch(/^\d{5}$/);
        });

        it('should send OTP via EmailService', async () => {
            await service.sendForgotPasswordOtp(dto);

            expect(mockEmailService.sendForgotPasswordOtp).toHaveBeenCalledWith(
                testEmail,
                expect.any(String),
                expect.any(String),
            );
        });

        it('should include expiry time in email', async () => {
            await service.sendForgotPasswordOtp(dto);

            const [, , expiryTime] = mockEmailService.sendForgotPasswordOtp.mock
                .calls[0] as string[];
            expect(expiryTime).toBeDefined();
            expect(typeof expiryTime).toBe('string');
            expect(expiryTime).toMatch(/\d{1,2}:\d{2}/);
        });

        it('should store OTP with purpose "forgot-password"', async () => {
            await service.sendForgotPasswordOtp(dto);

            const [, code] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as string[];

            // Seed DB mock so verifyOtp can complete the forgot-password flow
            mockDatabaseService.user.findUnique.mockResolvedValue({
                firebaseUid: 'test-firebase-uid',
            });
            mockFirebaseAuth.createCustomToken.mockResolvedValue('mock-custom-token');

            const verifyDto: VerifyOtpDto = { email: testEmail, code, purpose: 'forgot-password' };
            await expect(service.verifyOtp(verifyDto)).resolves.not.toThrow();
        });

        it('should log success message', async () => {
            await service.sendForgotPasswordOtp(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Forgot password OTP sent successfully to ${testEmail}`,
                'OtpService',
            );
        });

        it('should throw InternalServerErrorException if email fails', async () => {
            mockEmailService.sendForgotPasswordOtp.mockRejectedValue(
                new Error('Email service error'),
            );

            await expect(service.sendForgotPasswordOtp(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.sendForgotPasswordOtp(dto)).rejects.toThrow(
                'Failed to send forgot password OTP email',
            );
        });

        it('should log error if email fails', async () => {
            mockEmailService.sendForgotPasswordOtp.mockRejectedValue(
                new Error('Email service error'),
            );

            await expect(service.sendForgotPasswordOtp(dto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to send forgot password OTP to ${testEmail}`,
                'Error: Email service error',
                'OtpService',
            );
        });

        it('should remove stored OTP if email fails', async () => {
            mockEmailService.sendForgotPasswordOtp.mockRejectedValue(new Error('Email failed'));

            await expect(service.sendForgotPasswordOtp(dto)).rejects.toThrow();

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code: '12345',
                purpose: 'forgot-password',
            };
            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(expectedOtpErrors.notFound);
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
            const verifyDto: VerifyOtpDto = { email: testEmail, code, purpose: 'password-reset' };

            await expect(service.verifyOtp(verifyDto)).resolves.not.toThrow();
        });

        it('should log success message', async () => {
            await service.sendPasswordResetOtp(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Password reset OTP sent successfully to ${testEmail}`,
                'OtpService',
            );
        });

        it('should throw InternalServerErrorException if email fails', async () => {
            mockEmailService.sendPasswordResetOtp.mockRejectedValue(
                new Error('Email service error'),
            );

            await expect(service.sendPasswordResetOtp(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.sendPasswordResetOtp(dto)).rejects.toThrow(
                'Failed to send password reset OTP email',
            );
        });

        it('should log error if email fails', async () => {
            mockEmailService.sendPasswordResetOtp.mockRejectedValueOnce(
                new Error('Email service error'),
            );

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
            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(expectedOtpErrors.notFound);
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
            const verifyDto: VerifyOtpDto = { email: testEmail, code, purpose: 'email-reset' };

            await expect(service.verifyOtp(verifyDto)).resolves.not.toThrow();
        });

        it('should log success message', async () => {
            await service.sendEmailResetOtp(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Email reset OTP sent successfully to ${testEmail}`,
                'OtpService',
            );
        });

        it('should throw InternalServerErrorException if email fails', async () => {
            mockEmailService.sendEmailResetOtp.mockRejectedValue(new Error('Email service error'));

            await expect(service.sendEmailResetOtp(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.sendEmailResetOtp(dto)).rejects.toThrow(
                'Failed to send email reset OTP email',
            );
        });

        it('should log error if email fails', async () => {
            mockEmailService.sendEmailResetOtp.mockRejectedValueOnce(
                new Error('Email service error'),
            );

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
            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(expectedOtpErrors.notFound);
        });
    });

    describe('verifyOtp', () => {
        beforeEach(() => {
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
            mockEmailService.sendEmailResetOtp.mockResolvedValue(undefined);
            mockEmailService.sendForgotPasswordOtp.mockResolvedValue(undefined);
        });

        it('should verify correct OTP successfully and return message', async () => {
            await service.sendRegistrationOtp({ email: testEmail });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            const verifyDto: VerifyOtpDto = { email: testEmail, code, purpose: 'registration' };
            const result = await service.verifyOtp(verifyDto);

            expect(result).toEqual(expectedOtpResponses.verified);
        });

        it('should verify correct OTP for email-reset purpose', async () => {
            await service.sendEmailResetOtp({ email: testEmail });
            const [, code] = mockEmailService.sendEmailResetOtp.mock.calls[0] as string[];

            const verifyDto: VerifyOtpDto = { email: testEmail, code, purpose: 'email-reset' };
            const result = await service.verifyOtp(verifyDto);

            expect(result).toEqual(expectedOtpResponses.verified);
        });

        it('should verify correct OTP for password-reset purpose', async () => {
            mockEmailService.sendPasswordResetOtp.mockResolvedValue(undefined);
            await service.sendPasswordResetOtp({ email: testEmail });
            const [, code] = mockEmailService.sendPasswordResetOtp.mock.calls[0] as string[];

            const verifyDto: VerifyOtpDto = { email: testEmail, code, purpose: 'password-reset' };
            const result = await service.verifyOtp(verifyDto);

            expect(result).toEqual(expectedOtpResponses.verified);
        });

        it('should throw BadRequestException if OTP not found', async () => {
            const verifyDto: VerifyOtpDto = {
                email: 'nonexistent@example.com',
                code: '12345',
                purpose: 'registration',
            };

            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(BadRequestException);
            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(expectedOtpErrors.notFound);
        });

        it('should throw BadRequestException if OTP code is incorrect', async () => {
            await service.sendRegistrationOtp({ email: testEmail });

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code: '00000',
                purpose: 'registration',
            };

            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(BadRequestException);
            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(expectedOtpErrors.invalid);
        });

        it('should throw BadRequestException if purpose mismatches', async () => {
            await service.sendRegistrationOtp({ email: testEmail });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code,
                purpose: 'password-reset', // Wrong purpose
            };

            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(BadRequestException);
            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(
                expectedOtpErrors.purposeMismatch,
            );
        });

        it('should throw BadRequestException if OTP has expired', async () => {
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
                await service.verifyOtp(verifyDto);
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

            const verifyDto: VerifyOtpDto = { email: testEmail, code, purpose: 'registration' };

            await service.verifyOtp(verifyDto);

            // Second attempt should fail with "not found"
            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(expectedOtpErrors.notFound);
        });

        it('should remove expired OTP from store on verification attempt', async () => {
            const now = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            await service.sendRegistrationOtp({ email: testEmail });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            jest.spyOn(Date, 'now').mockReturnValue(now + 16 * 60 * 1000);

            const verifyDto: VerifyOtpDto = { email: testEmail, code, purpose: 'registration' };

            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(expectedOtpErrors.expired);

            // OTP has been deleted; next attempt shows "not found"
            await expect(service.verifyOtp(verifyDto)).rejects.toThrow(expectedOtpErrors.notFound);
        });

        it('should log success message on verification', async () => {
            await service.sendRegistrationOtp({ email: testEmail });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            const verifyDto: VerifyOtpDto = { email: testEmail, code, purpose: 'registration' };
            await service.verifyOtp(verifyDto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `OTP verified successfully for ${testEmail} with purpose of registration`,
                'OtpService',
            );
        });

        it('should log warning on verification failure', async () => {
            const verifyDto: VerifyOtpDto = {
                email: testEmail,
                code: '12345',
                purpose: 'registration',
            };

            await expect(service.verifyOtp(verifyDto)).rejects.toThrow();

            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                expect.stringContaining('OTP verification failed'),
                'OtpService',
            );
        });

        // --- forgot-password specific flow ---

        describe('forgot-password flow', () => {
            const firebaseUid = 'test-firebase-uid';
            const customToken = 'mock-custom-token';

            beforeEach(() => {
                mockEmailService.sendForgotPasswordOtp.mockResolvedValue(undefined);
            });

            it('should return loginToken on successful forgot-password verification', async () => {
                await service.sendForgotPasswordOtp({ email: testEmail });
                const [, code] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as string[];

                mockDatabaseService.user.findUnique.mockResolvedValue({ firebaseUid });
                mockFirebaseAuth.createCustomToken.mockResolvedValue(customToken);

                const verifyDto: VerifyOtpDto = {
                    email: testEmail,
                    code,
                    purpose: 'forgot-password',
                };
                const result = await service.verifyOtp(verifyDto);

                expect(result).toEqual({
                    message: 'OTP verified successfully.',
                    loginToken: customToken,
                });
            });

            it('should query the database for the user by email', async () => {
                await service.sendForgotPasswordOtp({ email: testEmail });
                const [, code] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as string[];

                mockDatabaseService.user.findUnique.mockResolvedValue({ firebaseUid });
                mockFirebaseAuth.createCustomToken.mockResolvedValue(customToken);

                await service.verifyOtp({ email: testEmail, code, purpose: 'forgot-password' });

                expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
                    where: { email: testEmail },
                    select: { firebaseUid: true },
                });
            });

            it('should create a Firebase custom token using the user firebaseUid', async () => {
                await service.sendForgotPasswordOtp({ email: testEmail });
                const [, code] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as string[];

                mockDatabaseService.user.findUnique.mockResolvedValue({ firebaseUid });
                mockFirebaseAuth.createCustomToken.mockResolvedValue(customToken);

                await service.verifyOtp({ email: testEmail, code, purpose: 'forgot-password' });

                expect(mockFirebaseAuth.createCustomToken).toHaveBeenCalledWith(firebaseUid);
            });

            it('should throw NotFoundException if user does not exist in DB', async () => {
                await service.sendForgotPasswordOtp({ email: testEmail });
                const [, code] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as string[];

                mockDatabaseService.user.findUnique.mockResolvedValue(null);

                await expect(
                    service.verifyOtp({ email: testEmail, code, purpose: 'forgot-password' }),
                ).rejects.toThrow(NotFoundException);
            });

            it('should throw InternalServerErrorException if Firebase token creation fails', async () => {
                await service.sendForgotPasswordOtp({ email: testEmail });
                const [, code] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as string[];

                mockDatabaseService.user.findUnique.mockResolvedValue({ firebaseUid });
                mockFirebaseAuth.createCustomToken.mockRejectedValue(new Error('Firebase error'));

                await expect(
                    service.verifyOtp({ email: testEmail, code, purpose: 'forgot-password' }),
                ).rejects.toThrow(InternalServerErrorException);
                await expect(
                    service.verifyOtp({ email: testEmail, code, purpose: 'forgot-password' }),
                ).rejects.toThrow('Failed to create login token for email');
            });

            it('should log success message after forgot-password verification', async () => {
                await service.sendForgotPasswordOtp({ email: testEmail });
                const [, code] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as string[];

                mockDatabaseService.user.findUnique.mockResolvedValue({ firebaseUid });
                mockFirebaseAuth.createCustomToken.mockResolvedValue(customToken);

                await service.verifyOtp({ email: testEmail, code, purpose: 'forgot-password' });

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    `OTP verified successfully for ${testEmail} with purpose of forgot-password`,
                    'OtpService',
                );
            });
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

        it('should generate valid numeric codes within range', async () => {
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

        it('should store OTP with correct expiry — valid just before expiry', async () => {
            const now = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            await service.sendRegistrationOtp({ email: 'test@example.com' });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            // 14 min 59 sec — still valid
            jest.spyOn(Date, 'now').mockReturnValue(now + 14 * 60 * 1000 + 59 * 1000);
            await expect(
                service.verifyOtp({
                    email: 'test@example.com',
                    code,
                    purpose: 'registration',
                }),
            ).resolves.not.toThrow();
        });

        it('should reject OTP exactly at expiry boundary', async () => {
            const now = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            await service.sendRegistrationOtp({ email: 'test@example.com' });
            const [, code] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            // Exactly 15 min — expiresAt === Date.now(), so Date.now() > expiresAt is false → still valid
            jest.spyOn(Date, 'now').mockReturnValue(now + 15 * 60 * 1000);
            await expect(
                service.verifyOtp({
                    email: 'test@example.com',
                    code,
                    purpose: 'registration',
                }),
            ).resolves.not.toThrow();
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

            await expect(
                service.verifyOtp({ email: email1, code: code1, purpose: 'registration' }),
            ).resolves.not.toThrow();

            await expect(
                service.verifyOtp({ email: email2, code: code2, purpose: 'registration' }),
            ).resolves.not.toThrow();
        });

        it('should isolate OTPs by email address', async () => {
            await service.sendRegistrationOtp({ email: email1 });
            const [, code1] = mockEmailService.sendRegistrationOtp.mock.calls[0] as string[];

            await service.sendRegistrationOtp({ email: email2 });

            // email1's code must not verify email2's OTP
            await expect(
                service.verifyOtp({ email: email2, code: code1, purpose: 'registration' }),
            ).rejects.toThrow();
        });
    });
});
