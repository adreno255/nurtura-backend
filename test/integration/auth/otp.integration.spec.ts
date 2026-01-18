import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, BadRequestException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OtpService } from '../../../src/auth/otp/otp.service';
import { EmailService } from '../../../src/email/email.service';
import { MyLoggerService } from '../../../src/my-logger/my-logger.service';
import { TestDatabaseHelper, TestDataHelper } from '../../helpers';
import { createMockEmailService } from '../../mocks/sendgrid.mock';
import { envValidationSchema } from '../../../src/config/env.validation';

describe('OtpService Integration Tests', () => {
    let app: INestApplication;
    let otpService: OtpService;
    let dbHelper: TestDatabaseHelper;

    // Mock EmailService (external SendGrid API)
    const mockEmailService = createMockEmailService();

    beforeAll(async () => {
        // Initialize database helper
        dbHelper = new TestDatabaseHelper();
        await dbHelper.connect();

        // Create testing module with mocked EmailService
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.test',
                    validationSchema: envValidationSchema,
                }),
            ],
            providers: [
                OtpService,
                MyLoggerService,
                {
                    provide: EmailService,
                    useValue: mockEmailService,
                },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        otpService = moduleFixture.get<OtpService>(OtpService);
    });

    afterAll(async () => {
        await dbHelper.clearDatabase();
        await dbHelper.disconnect();
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('sendRegistrationOtp', () => {
        it('should generate and send registration OTP via email', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

            await otpService.sendRegistrationOtp({ email });

            expect(mockEmailService.sendRegistrationOtp).toHaveBeenCalledTimes(1);
            expect(mockEmailService.sendRegistrationOtp).toHaveBeenCalledWith(
                email,
                expect.any(String), // OTP code
                expect.any(String), // Expiry time
            );

            // Verify OTP code format (5 digits)
            const [, otpCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];
            expect(TestDataHelper.isValidOtp(otpCode)).toBe(true);
        });

        it('should store OTP in memory for verification', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

            await otpService.sendRegistrationOtp({ email });

            // Get the generated OTP code
            const [, otpCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Verify OTP can be validated
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'registration',
                }),
            ).not.toThrow();
        });

        it('should generate unique OTP codes for different emails', async () => {
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

            const email1 = TestDataHelper.generateRandomEmail();
            const email2 = TestDataHelper.generateRandomEmail();

            await otpService.sendRegistrationOtp({ email: email1 });
            await otpService.sendRegistrationOtp({ email: email2 });

            const [, code1] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];
            const [, code2] = mockEmailService.sendRegistrationOtp.mock.calls[1] as [
                string,
                string,
                string,
            ];

            // Codes should be different (very unlikely to be same)
            // Note: There's a tiny chance they could match, but statistically negligible
            expect(code1).not.toBe(code2);
        });

        it('should overwrite existing OTP when sending new one to same email', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

            // Send first OTP
            await otpService.sendRegistrationOtp({ email });
            const [, firstCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Send second OTP to same email
            await otpService.sendRegistrationOtp({ email });
            const [, secondCode] = mockEmailService.sendRegistrationOtp.mock.calls[1] as [
                string,
                string,
                string,
            ];

            // First OTP should no longer be valid
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: firstCode,
                    purpose: 'registration',
                }),
            ).toThrow(BadRequestException);

            // Second OTP should be valid
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: secondCode,
                    purpose: 'registration',
                }),
            ).not.toThrow();
        });

        it('should throw error if email service fails', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendRegistrationOtp.mockRejectedValue(new Error('SendGrid error'));

            await expect(otpService.sendRegistrationOtp({ email })).rejects.toThrow(
                'Failed to send registration OTP email',
            );
        });

        it('should remove OTP from storage if email fails to send', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendRegistrationOtp.mockRejectedValue(new Error('SendGrid error'));

            // Attempt to send OTP (will fail)
            await expect(otpService.sendRegistrationOtp({ email })).rejects.toThrow();

            // OTP should not be stored
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: '12345',
                    purpose: 'registration',
                }),
            ).toThrow('No OTP found for this email');
        });

        it('should include expiry time in email', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

            await otpService.sendRegistrationOtp({ email });

            const [, , expiryTime] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Expiry time should be a time string (e.g., "10:30 AM")
            expect(expiryTime).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
        });

        it('should handle multiple concurrent OTP requests for different users', async () => {
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

            const emails = Array.from({ length: 5 }, () => TestDataHelper.generateRandomEmail());

            // Send OTPs concurrently
            await Promise.all(emails.map((email) => otpService.sendRegistrationOtp({ email })));

            // All emails should have been sent
            expect(mockEmailService.sendRegistrationOtp).toHaveBeenCalledTimes(5);

            // Each email should have a valid OTP stored
            emails.forEach((email, index) => {
                const [, otpCode] = mockEmailService.sendRegistrationOtp.mock.calls[index] as [
                    string,
                    string,
                    string,
                ];

                expect(() =>
                    otpService.verifyOtp({
                        email,
                        code: otpCode,
                        purpose: 'registration',
                    }),
                ).not.toThrow();
            });
        });
    });

    describe('sendForgotPasswordOtp', () => {
        it('should generate and send forgot password OTP via email', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendForgotPasswordOtp.mockResolvedValue(undefined);

            await otpService.sendForgotPasswordOtp({ email });

            expect(mockEmailService.sendForgotPasswordOtp).toHaveBeenCalledTimes(1);
            expect(mockEmailService.sendForgotPasswordOtp).toHaveBeenCalledWith(
                email,
                expect.any(String), // OTP code
                expect.any(String), // Expiry time
            );

            // Verify OTP code format (5 digits)
            const [, otpCode] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];
            expect(TestDataHelper.isValidOtp(otpCode)).toBe(true);
        });

        it('should store OTP with correct purpose for verification', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendForgotPasswordOtp.mockResolvedValue(undefined);

            await otpService.sendForgotPasswordOtp({ email });

            const [, otpCode] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Should verify with 'forgot-password' purpose
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'forgot-password',
                }),
            ).not.toThrow();
        });

        it('should throw error if email service fails', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendForgotPasswordOtp.mockRejectedValue(new Error('SendGrid error'));

            await expect(otpService.sendForgotPasswordOtp({ email })).rejects.toThrow(
                'Failed to send password reset OTP email',
            );
        });

        it('should overwrite existing forgot password OTP when sending new one', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendForgotPasswordOtp.mockResolvedValue(undefined);

            // Send first OTP
            await otpService.sendForgotPasswordOtp({ email });
            const [, firstCode] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Send second OTP
            await otpService.sendForgotPasswordOtp({ email });
            const [, secondCode] = mockEmailService.sendForgotPasswordOtp.mock.calls[1] as [
                string,
                string,
                string,
            ];

            // First OTP should be invalid
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: firstCode,
                    purpose: 'forgot-password',
                }),
            ).toThrow(BadRequestException);

            // Second OTP should be valid
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: secondCode,
                    purpose: 'forgot-password',
                }),
            ).not.toThrow();
        });
    });

    describe('verifyOtp', () => {
        it('should successfully verify correct OTP', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

            await otpService.sendRegistrationOtp({ email });
            const [, otpCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'registration',
                }),
            ).not.toThrow();
        });

        it('should throw error if OTP not found', () => {
            const email = TestDataHelper.generateRandomEmail();

            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: '12345',
                    purpose: 'registration',
                }),
            ).toThrow(BadRequestException);
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: '12345',
                    purpose: 'registration',
                }),
            ).toThrow('No OTP found for this email');
        });

        it('should throw error if OTP code is incorrect', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

            await otpService.sendRegistrationOtp({ email });

            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: '00000', // Wrong code
                    purpose: 'registration',
                }),
            ).toThrow(BadRequestException);
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: '00000',
                    purpose: 'registration',
                }),
            ).toThrow('Invalid OTP code');
        });

        it('should throw error if purpose mismatches', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

            await otpService.sendRegistrationOtp({ email });
            const [, otpCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Try to verify with wrong purpose
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'forgot-password', // Wrong purpose
                }),
            ).toThrow(BadRequestException);
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'forgot-password',
                }),
            ).toThrow('Invalid OTP context');
        });

        it('should throw error if OTP has expired', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const now = Date.now();

            // Mock Date.now to control time
            jest.spyOn(Date, 'now').mockReturnValue(now);

            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
            await otpService.sendRegistrationOtp({ email });

            const [, otpCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Fast-forward time by 16 minutes (past 15-minute expiry)
            jest.spyOn(Date, 'now').mockReturnValue(now + 16 * 60 * 1000);

            let thrownError: unknown = null;
            try {
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'registration',
                });
            } catch (e) {
                thrownError = e as Error;
            }

            expect(thrownError).not.toBeNull();
            expect(thrownError).toBeInstanceOf(BadRequestException);
            expect((thrownError as BadRequestException).message).toContain('OTP has expired.');

            // Restore Date.now
            jest.spyOn(Date, 'now').mockRestore();
        });

        it('should remove OTP after successful verification', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

            await otpService.sendRegistrationOtp({ email });
            const [, otpCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // First verification should succeed
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'registration',
                }),
            ).not.toThrow();

            // Second verification should fail (OTP already used)
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'registration',
                }),
            ).toThrow('No OTP found for this email');
        });

        it('should remove expired OTP from storage when verifying', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const now = Date.now();

            jest.spyOn(Date, 'now').mockReturnValue(now);

            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
            await otpService.sendRegistrationOtp({ email });

            const [, otpCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Fast-forward time past expiry
            jest.spyOn(Date, 'now').mockReturnValue(now + 16 * 60 * 1000);

            // First attempt should fail with "expired"
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'registration',
                }),
            ).toThrow('OTP has expired');

            // Second attempt should fail with "not found" (already removed)
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'registration',
                }),
            ).toThrow('No OTP found for this email');

            jest.spyOn(Date, 'now').mockRestore();
        });

        it('should verify OTP just before expiry time', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const now = Date.now();

            jest.spyOn(Date, 'now').mockReturnValue(now);

            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
            await otpService.sendRegistrationOtp({ email });

            const [, otpCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Fast-forward to 14:59 (just before 15-minute expiry)
            jest.spyOn(Date, 'now').mockReturnValue(now + 14 * 60 * 1000 + 59 * 1000);

            // Should still be valid
            expect(() =>
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'registration',
                }),
            ).not.toThrow();

            jest.spyOn(Date, 'now').mockRestore();
        });
    });

    describe('OTP isolation between users', () => {
        it('should isolate OTPs by email address', async () => {
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

            const email1 = TestDataHelper.generateRandomEmail();
            const email2 = TestDataHelper.generateRandomEmail();

            await otpService.sendRegistrationOtp({ email: email1 });
            await otpService.sendRegistrationOtp({ email: email2 });

            const [, code1] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];
            const [, code2] = mockEmailService.sendRegistrationOtp.mock.calls[1] as [
                string,
                string,
                string,
            ];

            // Using email1's code with email2 should fail
            expect(() =>
                otpService.verifyOtp({
                    email: email2,
                    code: code1,
                    purpose: 'registration',
                }),
            ).toThrow('Invalid OTP code');

            // Using email2's code with email1 should fail
            expect(() =>
                otpService.verifyOtp({
                    email: email1,
                    code: code2,
                    purpose: 'registration',
                }),
            ).toThrow('Invalid OTP code');

            // Correct combinations should work
            expect(() =>
                otpService.verifyOtp({
                    email: email1,
                    code: code1,
                    purpose: 'registration',
                }),
            ).not.toThrow();

            expect(() =>
                otpService.verifyOtp({
                    email: email2,
                    code: code2,
                    purpose: 'registration',
                }),
            ).not.toThrow();
        });

        it('should handle multiple users with different OTP purposes', async () => {
            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
            mockEmailService.sendForgotPasswordOtp.mockResolvedValue(undefined);

            const email1 = TestDataHelper.generateRandomEmail();
            const email2 = TestDataHelper.generateRandomEmail();

            // Email1: registration OTP
            await otpService.sendRegistrationOtp({ email: email1 });
            const [, regCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Email2: forgot password OTP
            await otpService.sendForgotPasswordOtp({ email: email2 });
            const [, pwdCode] = mockEmailService.sendForgotPasswordOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Verify with correct purposes
            expect(() =>
                otpService.verifyOtp({
                    email: email1,
                    code: regCode,
                    purpose: 'registration',
                }),
            ).not.toThrow();

            expect(() =>
                otpService.verifyOtp({
                    email: email2,
                    code: pwdCode,
                    purpose: 'forgot-password',
                }),
            ).not.toThrow();
        });
    });

    describe('OTP expiry edge cases', () => {
        it('should expire OTP exactly after 15 minutes', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const now = Date.now();

            jest.spyOn(Date, 'now').mockReturnValue(now);

            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
            await otpService.sendRegistrationOtp({ email });

            const [, otpCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Exactly after 15 minutes, OTP should be expired
            jest.spyOn(Date, 'now').mockReturnValue(now + 15 * 60 * 1000 + 1);

            let thrownError: unknown = null;
            try {
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'registration',
                });
            } catch (e) {
                thrownError = e as Error;
            }

            expect(thrownError).not.toBeNull();
            expect(thrownError).toBeInstanceOf(BadRequestException);
            expect((thrownError as BadRequestException).message).toContain('OTP has expired.');

            jest.spyOn(Date, 'now').mockRestore();
        });

        it('should handle system clock changes gracefully', async () => {
            const email = TestDataHelper.generateRandomEmail();
            let currentTime = Date.now();

            const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

            mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
            await otpService.sendRegistrationOtp({ email });

            const [, otpCode] = mockEmailService.sendRegistrationOtp.mock.calls[0] as [
                string,
                string,
                string,
            ];

            // Simulate clock going backwards (unlikely but possible)
            currentTime = currentTime - 5 * 60 * 1000; // 5 minutes in the past

            // OTP should still work (based on original expiry time)
            // This test verifies the OTP doesn't break with clock changes
            const verifyFn = () =>
                otpService.verifyOtp({
                    email,
                    code: otpCode,
                    purpose: 'registration',
                });

            // Should either work or fail gracefully (not crash)
            try {
                verifyFn();
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException);
            }

            dateNowSpy.mockRestore();
        });
    });
});
