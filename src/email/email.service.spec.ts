import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { EmailService } from './email.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import sgMail from '@sendgrid/mail';
import * as fs from 'fs';
import { createMockConfigService, createMockLogger } from '../../test/mocks';
import { testEmails, testExpiryTimes, testOtpCodes } from '../../test/fixtures';

// Mock @sendgrid/mail
jest.mock('@sendgrid/mail', () => ({
    setApiKey: jest.fn(),
    send: jest.fn(),
}));

// Mock fs
jest.mock('fs', () => ({
    readFileSync: jest.fn(),
}));

describe('EmailService', () => {
    let service: EmailService;

    const mockConfigService = createMockConfigService();

    const mockLoggerService = createMockLogger();

    const mockLogoBase64 = 'mock-logo-base64-content';
    const mockFacebookBase64 = 'mock-facebook-base64-content';

    const testEmail = testEmails.valid;
    const testCode = testOtpCodes.valid;
    const testExpiryTime = testExpiryTimes.future;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Mock fs.readFileSync to return base64 strings
        (fs.readFileSync as jest.Mock).mockImplementation((path: string) => {
            if (path.includes('Nurtura-Logo.png')) {
                return Buffer.from(mockLogoBase64);
            }
            if (path.includes('Facebook-icon.png')) {
                return Buffer.from(mockFacebookBase64);
            }
            throw new Error('File not found');
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmailService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: MyLoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        service = module.get<EmailService>(EmailService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('constructor', () => {
        it('should retrieve SENDGRID_API_KEY from ConfigService', () => {
            expect(mockConfigService.get).toHaveBeenCalledWith('SENDGRID_API_KEY');
        });

        it('should set SendGrid API key', () => {
            const setApiKeySpy = jest.spyOn(sgMail, 'setApiKey');
            expect(setApiKeySpy).toHaveBeenCalledWith(mockConfigService.get('SENDGRID_API_KEY'));
        });

        it('should load email assets', () => {
            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('Nurtura-Logo.png'),
            );
            expect(fs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('Facebook-icon.png'),
            );
        });

        it('should log success messages', () => {
            expect(mockLoggerService.bootstrap).toHaveBeenCalledWith(
                'Email assets loaded successfully',
                'EmailService',
            );
            expect(mockLoggerService.bootstrap).toHaveBeenCalledWith(
                'SendGrid initialized successfully',
                'EmailService',
            );
        });

        it('should throw error if SENDGRID_API_KEY is not configured', async () => {
            const mockConfigService = createMockConfigService({ SENDGRID_API_KEY: undefined });

            const createService = async () => {
                await Test.createTestingModule({
                    providers: [
                        EmailService,
                        {
                            provide: ConfigService,
                            useValue: mockConfigService,
                        },
                        {
                            provide: MyLoggerService,
                            useValue: mockLoggerService,
                        },
                    ],
                }).compile();
            };

            await expect(createService()).rejects.toThrow('SENDGRID_API_KEY is not configured');
        });

        it('should throw error if email assets fail to load', async () => {
            (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
                throw new Error('File not found');
            });

            const createService = async () => {
                await Test.createTestingModule({
                    providers: [
                        EmailService,
                        {
                            provide: ConfigService,
                            useValue: mockConfigService,
                        },
                        {
                            provide: MyLoggerService,
                            useValue: mockLoggerService,
                        },
                    ],
                }).compile();
            };

            await expect(createService()).rejects.toThrow(
                'Failed to load email assets. Please ensure images exist in src/assets/email/',
            );
        });

        it('should log error if assets fail to load', async () => {
            (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
                throw new Error('Read error');
            });

            const createService = async () => {
                await Test.createTestingModule({
                    providers: [
                        EmailService,
                        {
                            provide: ConfigService,
                            useValue: mockConfigService,
                        },
                        {
                            provide: MyLoggerService,
                            useValue: mockLoggerService,
                        },
                    ],
                }).compile();
            };

            await expect(createService()).rejects.toThrow();
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                'Failed to load email assets',
                'Read error',
                'EmailService',
            );
        });
    });

    describe('sendRegistrationOtp', () => {
        it('should send registration OTP email successfully', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendRegistrationOtp(testEmail, testCode, testExpiryTime);

            expect(sendSpy).toHaveBeenCalledTimes(1);
        });

        it('should use correct email configuration', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendRegistrationOtp(testEmail, testCode, testExpiryTime);

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: testEmail,
                    from: {
                        email: mockConfigService.get('SENDGRID_FROM_EMAIL'),
                        name: mockConfigService.get('SENDGRID_FROM_NAME'),
                    },
                    subject: 'OTP for your Nurtura authentication',
                }),
            );
        });

        it('should include email attachments', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendRegistrationOtp(testEmail, testCode, testExpiryTime);

            // Assert directly on the mock call
            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: [
                        expect.objectContaining({
                            filename: 'Nurtura-Logo.png',
                            content_id: 'logo',
                        }),
                        expect.objectContaining({
                            filename: 'Facebook-icon.png',
                            content_id: 'facebook',
                        }),
                    ],
                }),
            );
        });

        it('should include HTML template', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendRegistrationOtp(testEmail, testCode, testExpiryTime);

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            expect(callArgs.html).toBeDefined();
            expect(typeof callArgs.html).toBe('string');
            expect(callArgs.html.length).toBeGreaterThan(0);
        });

        it('should log success message', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendRegistrationOtp(testEmail, testCode, testExpiryTime);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Registration OTP email sent to ${testEmail}`,
                'EmailService',
            );
        });

        it('should throw InternalServerErrorException on send failure', async () => {
            const sendError = new Error('SendGrid error');
            (sgMail.send as jest.Mock).mockRejectedValue(sendError);

            await expect(
                service.sendRegistrationOtp(testEmail, testCode, testExpiryTime),
            ).rejects.toThrow(InternalServerErrorException);

            await expect(
                service.sendRegistrationOtp(testEmail, testCode, testExpiryTime),
            ).rejects.toThrow('Failed to send registration OTP email');
        });

        it('should log error on send failure', async () => {
            const sendError = new Error('SendGrid error');
            (sgMail.send as jest.Mock).mockRejectedValueOnce(sendError);

            await expect(
                service.sendRegistrationOtp(testEmail, testCode, testExpiryTime),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to send registration OTP to ${testEmail}`,
                'SendGrid error',
                'EmailService',
            );
        });
    });

    describe('sendPasswordResetOtp', () => {
        it('should send forgot password OTP email successfully', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendPasswordResetOtp(testEmail, testCode, testExpiryTime);

            expect(sendSpy).toHaveBeenCalledTimes(1);
        });

        it('should use correct email configuration', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendPasswordResetOtp(testEmail, testCode, testExpiryTime);

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: testEmail,
                    from: {
                        email: mockConfigService.get('SENDGRID_FROM_EMAIL'),
                        name: mockConfigService.get('SENDGRID_FROM_NAME'),
                    },
                    subject: 'Password Reset OTP for Nurtura',
                }),
            );
        });

        it('should include email attachments', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendPasswordResetOtp(testEmail, testCode, testExpiryTime);

            // Assert directly on the mock call
            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: [
                        expect.objectContaining({
                            filename: 'Nurtura-Logo.png',
                            content_id: 'logo',
                        }),
                        expect.objectContaining({
                            filename: 'Facebook-icon.png',
                            content_id: 'facebook',
                        }),
                    ],
                }),
            );
        });

        it('should include HTML template', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendPasswordResetOtp(testEmail, testCode, testExpiryTime);

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            expect(callArgs.html).toBeDefined();
            expect(typeof callArgs.html).toBe('string');
            expect(callArgs.html.length).toBeGreaterThan(0);
        });

        it('should log success message', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendPasswordResetOtp(testEmail, testCode, testExpiryTime);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Password reset OTP email sent to ${testEmail}`,
                'EmailService',
            );
        });

        it('should throw InternalServerErrorException on send failure', async () => {
            const sendError = new Error('SendGrid error');
            (sgMail.send as jest.Mock).mockRejectedValue(sendError);

            await expect(
                service.sendPasswordResetOtp(testEmail, testCode, testExpiryTime),
            ).rejects.toThrow(InternalServerErrorException);
            await expect(
                service.sendPasswordResetOtp(testEmail, testCode, testExpiryTime),
            ).rejects.toThrow('Failed to send password reset OTP email');
        });

        it('should log error on send failure', async () => {
            const sendError = new Error('SendGrid error');
            (sgMail.send as jest.Mock).mockRejectedValueOnce(sendError);

            await expect(
                service.sendPasswordResetOtp(testEmail, testCode, testExpiryTime),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to send password reset OTP to ${testEmail}`,
                'SendGrid error',
                'EmailService',
            );
        });
    });

    describe('sendEmailResetOtp', () => {
        it('should send email reset OTP successfully', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendEmailResetOtp(testEmail, testCode, testExpiryTime);

            expect(sendSpy).toHaveBeenCalledTimes(1);
        });

        it('should use correct configuration and subject', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendEmailResetOtp(testEmail, testCode, testExpiryTime);

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: testEmail,
                    from: {
                        email: mockConfigService.get('SENDGRID_FROM_EMAIL'),
                        name: mockConfigService.get('SENDGRID_FROM_NAME'),
                    },
                    subject: 'Email Reset OTP for Nurtura',
                }),
            );
        });

        it('should include attachments', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendEmailResetOtp(testEmail, testCode, testExpiryTime);

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: expect.any(Array) as object[],
                }),
            );
        });

        it('should log success message', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendEmailResetOtp(testEmail, testCode, testExpiryTime);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Email reset OTP email sent to ${testEmail}`,
                'EmailService',
            );
        });

        it('should throw and log on failure', async () => {
            const sendError = new Error('SendGrid error');
            (sgMail.send as jest.Mock).mockRejectedValueOnce(sendError);

            await expect(
                service.sendEmailResetOtp(testEmail, testCode, testExpiryTime),
            ).rejects.toThrow(InternalServerErrorException);

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to send email reset OTP to ${testEmail}`,
                'SendGrid error',
                'EmailService',
            );
        });
    });

    describe('sendEmailResetNotification', () => {
        it('should send reset notification successfully', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendEmailResetNotification(testEmail);
            expect(sendSpy).toHaveBeenCalledTimes(1);
        });

        it('should use correct configuration and subject', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendEmailResetNotification(testEmail);
            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: testEmail,
                    from: {
                        email: mockConfigService.get('SENDGRID_FROM_EMAIL'),
                        name: mockConfigService.get('SENDGRID_FROM_NAME'),
                    },
                    subject: 'Email Reset Notification for Nurtura',
                }),
            );
        });

        it('should log success message', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendEmailResetNotification(testEmail);
            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Email reset notification email sent to ${testEmail}`,
                'EmailService',
            );
        });

        it('should throw and log on failure', async () => {
            const sendError = new Error('SendGrid error');
            (sgMail.send as jest.Mock).mockRejectedValueOnce(sendError);

            await expect(service.sendEmailResetNotification(testEmail)).rejects.toThrow(
                InternalServerErrorException,
            );
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to send email reset notification to ${testEmail}`,
                'SendGrid error',
                'EmailService',
            );
        });
    });

    describe('email content', () => {
        it('should pass OTP code to registration template', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendRegistrationOtp(testEmail, testCode, testExpiryTime);

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            const regexPattern = testCode.split('').join('.*?');
            const otpRegex = new RegExp(regexPattern, 's');

            expect(callArgs.html).toMatch(otpRegex);
        });

        it('should pass OTP code to forgot password template', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendPasswordResetOtp(testEmail, testCode, testExpiryTime);

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            const regexPattern = testCode.split('').join('.*?');
            const otpRegex = new RegExp(regexPattern, 's');

            expect(callArgs.html).toMatch(otpRegex);
        });

        it('should pass expiry time to registration template', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendRegistrationOtp(testEmail, testCode, testExpiryTime);

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            expect(callArgs.html).toContain(testExpiryTime);
        });

        it('should pass expiry time to forgot password template', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendPasswordResetOtp(testEmail, testCode, testExpiryTime);

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            expect(callArgs.html).toContain(testExpiryTime);
        });

        it('should pass OTP code and expiry to email reset OTP template', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendEmailResetOtp(testEmail, testCode, testExpiryTime);

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            expect(callArgs.html).toContain(testExpiryTime);
            const otpRegex = new RegExp(testCode.split('').join('.*?'), 's');
            expect(callArgs.html).toMatch(otpRegex);
        });

        it('should render notification template without OTP', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendEmailResetNotification(testEmail);

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            expect(callArgs.html).toBeDefined();
            expect(callArgs.html).not.toContain(testCode);
            expect(callArgs.html).not.toContain(testExpiryTime);
        });
    });

    describe('error handling edge cases', () => {
        it('should handle non-Error objects in send failure', async () => {
            (sgMail.send as jest.Mock).mockRejectedValueOnce('String error');

            await expect(
                service.sendRegistrationOtp('test@example.com', '123456', '10:00 AM'),
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('should handle non-Error objects in asset loading failure', async () => {
            (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
                throw 'String error' as any;
            });

            const createService = async () => {
                await Test.createTestingModule({
                    providers: [
                        EmailService,
                        {
                            provide: ConfigService,
                            useValue: mockConfigService,
                        },
                        {
                            provide: MyLoggerService,
                            useValue: mockLoggerService,
                        },
                    ],
                }).compile();
            };

            await expect(createService()).rejects.toThrow();
        });
    });
});
