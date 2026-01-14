import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { EmailService } from './email.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import sgMail from '@sendgrid/mail';
import * as fs from 'fs';

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

    const mockConfigService = {
        get: jest.fn((key: string) => {
            switch (key) {
                case 'SENDGRID_API_KEY':
                    return mockApiKey;
                case 'SENDGRID_FROM_EMAIL':
                    return mockFromEmail;
                case 'SENDGRID_FROM_NAME':
                    return mockFromName;
                default:
                    return undefined;
            }
        }),
    };

    const mockLoggerService = {
        bootstrap: jest.fn(),
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    };

    const mockApiKey = 'SG.test-api-key';
    const mockFromEmail = 'noreply@nurtura.com';
    const mockFromName = 'Nurtura';
    const mockLogoBase64 = 'mock-logo-base64-content';
    const mockFacebookBase64 = 'mock-facebook-base64-content';

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
            expect(setApiKeySpy).toHaveBeenCalledWith(mockApiKey);
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
            const createService = async () => {
                await Test.createTestingModule({
                    providers: [
                        EmailService,
                        {
                            provide: ConfigService,
                            useValue: {
                                get: jest.fn(() => undefined),
                            },
                        },
                        {
                            provide: MyLoggerService,
                            useValue: {
                                bootstrap: jest.fn(),
                                log: jest.fn(),
                                error: jest.fn(),
                                warn: jest.fn(),
                            },
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
                            useValue: {
                                get: jest.fn((key: string) => {
                                    if (key === 'SENDGRID_API_KEY') return mockApiKey;
                                    return undefined;
                                }),
                            },
                        },
                        {
                            provide: MyLoggerService,
                            useValue: {
                                bootstrap: jest.fn(),
                                log: jest.fn(),
                                error: jest.fn(),
                                warn: jest.fn(),
                            },
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

            const mockLogger = {
                bootstrap: jest.fn(),
                log: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            };

            const createService = async () => {
                await Test.createTestingModule({
                    providers: [
                        EmailService,
                        {
                            provide: ConfigService,
                            useValue: {
                                get: jest.fn((key: string) => {
                                    if (key === 'SENDGRID_API_KEY') return mockApiKey;
                                    return undefined;
                                }),
                            },
                        },
                        {
                            provide: MyLoggerService,
                            useValue: mockLogger,
                        },
                    ],
                }).compile();
            };

            await expect(createService()).rejects.toThrow();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to load email assets',
                'Read error',
                'EmailService',
            );
        });
    });

    describe('sendRegistrationOtp', () => {
        const testEmail = 'test@example.com';
        const testCode = '123456';
        const testExpiryTime = '10:30 AM';

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
                        email: mockFromEmail,
                        name: mockFromName,
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

    describe('sendForgotPasswordOtp', () => {
        const testEmail = 'test@example.com';
        const testCode = '654321';
        const testExpiryTime = '11:45 AM';

        it('should send forgot password OTP email successfully', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendForgotPasswordOtp(testEmail, testCode, testExpiryTime);

            expect(sendSpy).toHaveBeenCalledTimes(1);
        });

        it('should use correct email configuration', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendForgotPasswordOtp(testEmail, testCode, testExpiryTime);

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: testEmail,
                    from: {
                        email: mockFromEmail,
                        name: mockFromName,
                    },
                    subject: 'Password Reset OTP for Nurtura',
                }),
            );
        });

        it('should include email attachments', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);
            const sendSpy = jest.spyOn(sgMail, 'send');

            await service.sendForgotPasswordOtp(testEmail, testCode, testExpiryTime);

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

            await service.sendForgotPasswordOtp(testEmail, testCode, testExpiryTime);

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            expect(callArgs.html).toBeDefined();
            expect(typeof callArgs.html).toBe('string');
            expect(callArgs.html.length).toBeGreaterThan(0);
        });

        it('should log success message', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            await service.sendForgotPasswordOtp(testEmail, testCode, testExpiryTime);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Forgot password OTP email sent to ${testEmail}`,
                'EmailService',
            );
        });

        it('should throw InternalServerErrorException on send failure', async () => {
            const sendError = new Error('SendGrid error');
            (sgMail.send as jest.Mock).mockRejectedValue(sendError);

            await expect(
                service.sendForgotPasswordOtp(testEmail, testCode, testExpiryTime),
            ).rejects.toThrow(InternalServerErrorException);
            await expect(
                service.sendForgotPasswordOtp(testEmail, testCode, testExpiryTime),
            ).rejects.toThrow('Failed to send password reset OTP email');
        });

        it('should log error on send failure', async () => {
            const sendError = new Error('SendGrid error');
            (sgMail.send as jest.Mock).mockRejectedValueOnce(sendError);

            await expect(
                service.sendForgotPasswordOtp(testEmail, testCode, testExpiryTime),
            ).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Failed to send forgot password OTP to ${testEmail}`,
                'SendGrid error',
                'EmailService',
            );
        });
    });

    describe('email content', () => {
        it('should pass OTP code to registration template', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            const testCode = '12345';
            await service.sendRegistrationOtp('test@example.com', testCode, '10:00 AM');

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            const regexPattern = testCode.split('').join('.*?');
            const otpRegex = new RegExp(regexPattern, 's');

            expect(callArgs.html).toMatch(otpRegex);
        });

        it('should pass OTP code to forgot password template', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            const testCode = '12345';
            await service.sendForgotPasswordOtp('test@example.com', testCode, '11:00 AM');

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            const regexPattern = testCode.split('').join('.*?');
            const otpRegex = new RegExp(regexPattern, 's');

            expect(callArgs.html).toMatch(otpRegex);
        });

        it('should pass expiry time to registration template', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            const expiryTime = '2:30 PM';
            await service.sendRegistrationOtp('test@example.com', '123456', expiryTime);

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            expect(callArgs.html).toContain(expiryTime);
        });

        it('should pass expiry time to forgot password template', async () => {
            (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 200 }, {}]);

            const expiryTime = '3:45 PM';
            await service.sendForgotPasswordOtp('test@example.com', '654321', expiryTime);

            const [callArgs] = (sgMail.send as jest.Mock).mock.calls[0] as [{ html: string }];
            expect(callArgs.html).toContain(expiryTime);
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
                            useValue: {
                                get: jest.fn((key: string) => {
                                    if (key === 'SENDGRID_API_KEY') return mockApiKey;
                                    return undefined;
                                }),
                            },
                        },
                        {
                            provide: MyLoggerService,
                            useValue: {
                                bootstrap: jest.fn(),
                                log: jest.fn(),
                                error: jest.fn(),
                                warn: jest.fn(),
                            },
                        },
                    ],
                }).compile();
            };

            await expect(createService()).rejects.toThrow();
        });
    });
});
