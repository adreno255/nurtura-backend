import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { type SendOtpRequestDto } from './dto/send-otp-request.dto';
import { type VerifyOtpDto } from './dto/verify-otp.dto';
import {
    validSendOtpDto,
    validVerifyOtpPasswordResetDto,
    validVerifyOtpRegistrationDto,
    expectedOtpResponses,
} from '../../../test/fixtures';
import { validEmailQueryDto } from '../../../test/fixtures';
import { createMockOtpService } from '../../../test/mocks';

describe('OtpController', () => {
    let controller: OtpController;

    const mockOtpService = createMockOtpService();

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [OtpController],
            providers: [
                {
                    provide: OtpService,
                    useValue: mockOtpService,
                },
            ],
        }).compile();

        controller = module.get<OtpController>(OtpController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('sendRegistrationOtp', () => {
        const dto: SendOtpRequestDto = validSendOtpDto;

        it('should send registration OTP successfully', async () => {
            mockOtpService.sendRegistrationOtp.mockResolvedValue(undefined);

            const result = await controller.sendRegistrationOtp(dto);

            expect(result).toEqual(expectedOtpResponses.registrationSent);
        });

        it('should call OtpService.sendRegistrationOtp with correct DTO', async () => {
            mockOtpService.sendRegistrationOtp.mockResolvedValue(undefined);

            await controller.sendRegistrationOtp(dto);

            expect(mockOtpService.sendRegistrationOtp).toHaveBeenCalledWith(dto);
        });

        it('should call OtpService.sendRegistrationOtp once', async () => {
            mockOtpService.sendRegistrationOtp.mockResolvedValue(undefined);

            await controller.sendRegistrationOtp(dto);

            expect(mockOtpService.sendRegistrationOtp).toHaveBeenCalledTimes(1);
        });

        it('should propagate service errors', async () => {
            mockOtpService.sendRegistrationOtp.mockRejectedValue(new Error('Service error'));

            await expect(controller.sendRegistrationOtp(dto)).rejects.toThrow('Service error');
        });

        it('should handle BadRequestException from service', async () => {
            mockOtpService.sendRegistrationOtp.mockRejectedValue(
                new BadRequestException('Invalid email'),
            );

            await expect(controller.sendRegistrationOtp(dto)).rejects.toThrow(BadRequestException);
        });

        it('should return consistent message format', async () => {
            mockOtpService.sendRegistrationOtp.mockResolvedValue(undefined);

            const result = await controller.sendRegistrationOtp(dto);

            expect(result).toHaveProperty('message');
            expect(typeof result.message).toBe('string');
        });

        it('should work with different email formats', async () => {
            const emails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org'];

            for (const email of emails) {
                mockOtpService.sendRegistrationOtp.mockResolvedValue(undefined);

                const testDto: SendOtpRequestDto = { email };
                await controller.sendRegistrationOtp(testDto);

                expect(mockOtpService.sendRegistrationOtp).toHaveBeenCalledWith(testDto);
            }
        });
    });

    describe('sendForgotPasswordOtp', () => {
        const dto: SendOtpRequestDto = validSendOtpDto;

        it('should send forgot password OTP successfully', async () => {
            mockOtpService.sendForgotPasswordOtp.mockResolvedValue(undefined);

            const result = await controller.sendForgotPasswordOtp(dto);

            expect(result).toEqual({
                message: 'Forgot password OTP sent successfully. Please check your email.',
            });
        });

        it('should call OtpService.sendForgotPasswordOtp with correct DTO', async () => {
            mockOtpService.sendForgotPasswordOtp.mockResolvedValue(undefined);

            await controller.sendForgotPasswordOtp(dto);

            expect(mockOtpService.sendForgotPasswordOtp).toHaveBeenCalledWith(dto);
        });

        it('should call OtpService.sendForgotPasswordOtp once', async () => {
            mockOtpService.sendForgotPasswordOtp.mockResolvedValue(undefined);

            await controller.sendForgotPasswordOtp(dto);

            expect(mockOtpService.sendForgotPasswordOtp).toHaveBeenCalledTimes(1);
        });

        it('should propagate service errors', async () => {
            mockOtpService.sendForgotPasswordOtp.mockRejectedValue(new Error('Service error'));

            await expect(controller.sendForgotPasswordOtp(dto)).rejects.toThrow('Service error');
        });

        it('should handle BadRequestException from service', async () => {
            mockOtpService.sendForgotPasswordOtp.mockRejectedValue(
                new BadRequestException('Invalid email'),
            );

            await expect(controller.sendForgotPasswordOtp(dto)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should handle InternalServerErrorException from service', async () => {
            mockOtpService.sendForgotPasswordOtp.mockRejectedValue(
                new InternalServerErrorException('Failed to send forgot password OTP email'),
            );

            await expect(controller.sendForgotPasswordOtp(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should return consistent message format', async () => {
            mockOtpService.sendForgotPasswordOtp.mockResolvedValue(undefined);

            const result = await controller.sendForgotPasswordOtp(dto);

            expect(result).toHaveProperty('message');
            expect(typeof result.message).toBe('string');
        });

        it('should work with different email formats', async () => {
            const emails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org'];

            for (const email of emails) {
                mockOtpService.sendForgotPasswordOtp.mockResolvedValue(undefined);

                const testDto: SendOtpRequestDto = { email };
                await controller.sendForgotPasswordOtp(testDto);

                expect(mockOtpService.sendForgotPasswordOtp).toHaveBeenCalledWith(testDto);
            }
        });
    });

    describe('sendPasswordResetOtp', () => {
        const dto: SendOtpRequestDto = validSendOtpDto;

        it('should send password reset OTP successfully', async () => {
            mockOtpService.sendPasswordResetOtp.mockResolvedValue(undefined);

            const result = await controller.sendPasswordResetOtp(dto);

            expect(result).toEqual(expectedOtpResponses.passwordResetSent);
        });

        it('should call OtpService.sendPasswordResetOtp with correct DTO', async () => {
            mockOtpService.sendPasswordResetOtp.mockResolvedValue(undefined);

            await controller.sendPasswordResetOtp(dto);

            expect(mockOtpService.sendPasswordResetOtp).toHaveBeenCalledWith(dto);
        });

        it('should call OtpService.sendPasswordResetOtp once', async () => {
            mockOtpService.sendPasswordResetOtp.mockResolvedValue(undefined);

            await controller.sendPasswordResetOtp(dto);

            expect(mockOtpService.sendPasswordResetOtp).toHaveBeenCalledTimes(1);
        });

        it('should propagate service errors', async () => {
            mockOtpService.sendPasswordResetOtp.mockRejectedValue(new Error('Service error'));

            await expect(controller.sendPasswordResetOtp(dto)).rejects.toThrow('Service error');
        });

        it('should handle BadRequestException from service', async () => {
            mockOtpService.sendPasswordResetOtp.mockRejectedValue(
                new BadRequestException('Invalid email'),
            );

            await expect(controller.sendPasswordResetOtp(dto)).rejects.toThrow(BadRequestException);
        });

        it('should return consistent message format', async () => {
            mockOtpService.sendPasswordResetOtp.mockResolvedValue(undefined);

            const result = await controller.sendPasswordResetOtp(dto);

            expect(result).toHaveProperty('message');
            expect(typeof result.message).toBe('string');
        });

        it('should work with different email formats', async () => {
            const emails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org'];

            for (const email of emails) {
                mockOtpService.sendPasswordResetOtp.mockResolvedValue(undefined);

                const testDto: SendOtpRequestDto = { email };
                await controller.sendPasswordResetOtp(testDto);

                expect(mockOtpService.sendPasswordResetOtp).toHaveBeenCalledWith(testDto);
            }
        });
    });

    describe('sendEmailResetOtp', () => {
        const dto: SendOtpRequestDto = validSendOtpDto;

        it('should send email reset OTP successfully', async () => {
            mockOtpService.sendEmailResetOtp.mockResolvedValue(undefined);

            const result = await controller.sendEmailResetOtp(dto);

            expect(result).toEqual(expectedOtpResponses.emailResetSent);
        });

        it('should call OtpService.sendEmailResetOtp with correct DTO', async () => {
            mockOtpService.sendEmailResetOtp.mockResolvedValue(undefined);

            await controller.sendEmailResetOtp(dto);

            expect(mockOtpService.sendEmailResetOtp).toHaveBeenCalledWith(dto);
        });

        it('should call OtpService.sendEmailResetOtp once', async () => {
            mockOtpService.sendEmailResetOtp.mockResolvedValue(undefined);

            await controller.sendEmailResetOtp(dto);

            expect(mockOtpService.sendEmailResetOtp).toHaveBeenCalledTimes(1);
        });

        it('should propagate service errors', async () => {
            mockOtpService.sendEmailResetOtp.mockRejectedValue(new Error('Service error'));

            await expect(controller.sendEmailResetOtp(dto)).rejects.toThrow('Service error');
        });

        it('should handle BadRequestException from service', async () => {
            mockOtpService.sendEmailResetOtp.mockRejectedValue(
                new BadRequestException('Invalid email'),
            );

            await expect(controller.sendEmailResetOtp(dto)).rejects.toThrow(BadRequestException);
        });

        it('should return consistent message format', async () => {
            mockOtpService.sendEmailResetOtp.mockResolvedValue(undefined);

            const result = await controller.sendEmailResetOtp(dto);

            expect(result).toHaveProperty('message');
            expect(typeof result.message).toBe('string');
        });

        it('should work with different email formats', async () => {
            const emails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org'];

            for (const email of emails) {
                mockOtpService.sendEmailResetOtp.mockResolvedValue(undefined);

                const testDto: SendOtpRequestDto = { email };
                await controller.sendEmailResetOtp(testDto);

                expect(mockOtpService.sendEmailResetOtp).toHaveBeenCalledWith(testDto);
            }
        });
    });

    describe('verifyOtp', () => {
        const dto: VerifyOtpDto = validVerifyOtpRegistrationDto;

        it('should verify OTP successfully', async () => {
            mockOtpService.verifyOtp.mockResolvedValue(expectedOtpResponses.verified);

            const result = await controller.verifyOtp(dto);

            expect(result).toEqual(expectedOtpResponses.verified);
        });

        it('should call OtpService.verifyOtp with correct DTO', async () => {
            mockOtpService.verifyOtp.mockResolvedValue(expectedOtpResponses.verified);

            await controller.verifyOtp(dto);

            expect(mockOtpService.verifyOtp).toHaveBeenCalledWith(dto);
        });

        it('should call OtpService.verifyOtp once', async () => {
            mockOtpService.verifyOtp.mockResolvedValue(expectedOtpResponses.verified);

            await controller.verifyOtp(dto);

            expect(mockOtpService.verifyOtp).toHaveBeenCalledTimes(1);
        });

        it('should propagate service errors', async () => {
            mockOtpService.verifyOtp.mockRejectedValue(new BadRequestException('Invalid OTP'));

            await expect(controller.verifyOtp(dto)).rejects.toThrow(BadRequestException);
            await expect(controller.verifyOtp(dto)).rejects.toThrow('Invalid OTP');
        });

        it('should handle expired OTP error', async () => {
            mockOtpService.verifyOtp.mockRejectedValue(
                new BadRequestException('OTP has expired. Please request a new one.'),
            );

            await expect(controller.verifyOtp(dto)).rejects.toThrow(BadRequestException);
            await expect(controller.verifyOtp(dto)).rejects.toThrow('OTP has expired');
        });

        it('should handle OTP not found error', async () => {
            mockOtpService.verifyOtp.mockRejectedValue(
                new BadRequestException('No OTP found for this email'),
            );

            await expect(controller.verifyOtp(dto)).rejects.toThrow(BadRequestException);
            await expect(controller.verifyOtp(dto)).rejects.toThrow('No OTP found');
        });

        it('should handle purpose mismatch error', async () => {
            mockOtpService.verifyOtp.mockRejectedValue(
                new BadRequestException('Invalid OTP context'),
            );

            await expect(controller.verifyOtp(dto)).rejects.toThrow(BadRequestException);
            await expect(controller.verifyOtp(dto)).rejects.toThrow('Invalid OTP context');
        });

        it('should return consistent message format', async () => {
            mockOtpService.verifyOtp.mockResolvedValue(expectedOtpResponses.verified);

            const result = await controller.verifyOtp(dto);

            expect(result).toHaveProperty('message');
            expect(typeof result.message).toBe('string');
        });

        it('should verify registration OTP', async () => {
            mockOtpService.verifyOtp.mockResolvedValue(expectedOtpResponses.verified);

            const result = await controller.verifyOtp(validVerifyOtpRegistrationDto);

            expect(result).toEqual(expectedOtpResponses.verified);
        });

        it('should verify password-reset OTP', async () => {
            mockOtpService.verifyOtp.mockResolvedValue(expectedOtpResponses.verified);

            const result = await controller.verifyOtp(validVerifyOtpPasswordResetDto);

            expect(result).toEqual(expectedOtpResponses.verified);
        });

        it('should return loginToken for forgot-password OTP', async () => {
            const forgotPasswordResponse = {
                ...expectedOtpResponses.verified,
                loginToken: 'mock-custom-token',
            };
            mockOtpService.verifyOtp.mockResolvedValue(forgotPasswordResponse);

            const forgotPasswordDto: VerifyOtpDto = {
                email: 'test@example.com',
                code: '12345',
                purpose: 'forgot-password',
            };
            const result = await controller.verifyOtp(forgotPasswordDto);

            expect(result).toEqual(forgotPasswordResponse);
            expect(result).toHaveProperty('loginToken');
        });

        it('should work with different OTP codes', async () => {
            const codes = ['12345', '00000', '99999', '54321'];

            for (const code of codes) {
                mockOtpService.verifyOtp.mockResolvedValue(expectedOtpResponses.verified);

                const testDto: VerifyOtpDto = {
                    email: 'test@example.com',
                    code,
                    purpose: 'registration',
                };

                await controller.verifyOtp(testDto);

                expect(mockOtpService.verifyOtp).toHaveBeenCalledWith(testDto);
            }
        });
    });

    describe('response structure', () => {
        it('should return object with message property for sendRegistrationOtp', async () => {
            mockOtpService.sendRegistrationOtp.mockResolvedValue(undefined);

            const result = await controller.sendRegistrationOtp({ email: 'test@example.com' });

            expect(Object.keys(result)).toEqual(['message']);
        });

        it('should return object with message property for sendForgotPasswordOtp', async () => {
            mockOtpService.sendForgotPasswordOtp.mockResolvedValue(undefined);

            const result = await controller.sendForgotPasswordOtp({ email: 'test@example.com' });

            expect(Object.keys(result)).toEqual(['message']);
        });

        it('should return object with message property for sendPasswordResetOtp', async () => {
            mockOtpService.sendPasswordResetOtp.mockResolvedValue(undefined);

            const result = await controller.sendPasswordResetOtp({ email: 'test@example.com' });

            expect(Object.keys(result)).toEqual(['message']);
        });

        it('should return object with message property for sendEmailResetOtp', async () => {
            mockOtpService.sendEmailResetOtp.mockResolvedValue(undefined);

            const result = await controller.sendEmailResetOtp({ email: 'test@example.com' });

            expect(Object.keys(result)).toEqual(['message']);
        });

        it('should return object with message property for verifyOtp', async () => {
            mockOtpService.verifyOtp.mockResolvedValue(expectedOtpResponses.verified);

            const result = await controller.verifyOtp(validVerifyOtpRegistrationDto);

            expect(result).toHaveProperty('message');
        });

        it('should return object with message and loginToken for forgot-password verifyOtp', async () => {
            const response = { ...expectedOtpResponses.verified, loginToken: 'mock-token' };
            mockOtpService.verifyOtp.mockResolvedValue(response);

            const result = await controller.verifyOtp({
                email: 'test@example.com',
                code: '12345',
                purpose: 'forgot-password',
            });

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('loginToken');
        });
    });

    describe('integration with OtpService', () => {
        it('should delegate all logic to OtpService', async () => {
            mockOtpService.sendRegistrationOtp.mockResolvedValue(undefined);
            mockOtpService.sendForgotPasswordOtp.mockResolvedValue(undefined);
            mockOtpService.sendPasswordResetOtp.mockResolvedValue(undefined);
            mockOtpService.sendEmailResetOtp.mockResolvedValue(undefined);
            mockOtpService.verifyOtp.mockResolvedValue(expectedOtpResponses.verified);

            await controller.sendRegistrationOtp(validEmailQueryDto);
            await controller.sendForgotPasswordOtp(validEmailQueryDto);
            await controller.sendPasswordResetOtp(validEmailQueryDto);
            await controller.sendEmailResetOtp(validEmailQueryDto);
            await controller.verifyOtp(validVerifyOtpRegistrationDto);

            expect(mockOtpService.sendRegistrationOtp).toHaveBeenCalled();
            expect(mockOtpService.sendForgotPasswordOtp).toHaveBeenCalled();
            expect(mockOtpService.sendPasswordResetOtp).toHaveBeenCalled();
            expect(mockOtpService.sendEmailResetOtp).toHaveBeenCalled();
            expect(mockOtpService.verifyOtp).toHaveBeenCalled();
        });

        it('should not add additional business logic', async () => {
            mockOtpService.sendRegistrationOtp.mockResolvedValue(undefined);

            await controller.sendRegistrationOtp(validSendOtpDto);

            // Should pass DTO directly to service without modification
            expect(mockOtpService.sendRegistrationOtp).toHaveBeenCalledWith(validSendOtpDto);
        });
    });

    describe('error propagation', () => {
        it('should not catch service errors in sendRegistrationOtp', async () => {
            mockOtpService.sendRegistrationOtp.mockRejectedValue(new Error('OTP service error'));

            await expect(controller.sendRegistrationOtp(validSendOtpDto)).rejects.toThrow(
                'OTP service error',
            );
        });

        it('should not catch service errors in sendForgotPasswordOtp', async () => {
            mockOtpService.sendForgotPasswordOtp.mockRejectedValue(new Error('OTP service error'));

            await expect(controller.sendForgotPasswordOtp(validSendOtpDto)).rejects.toThrow(
                'OTP service error',
            );
        });

        it('should not catch service errors in sendPasswordResetOtp', async () => {
            mockOtpService.sendPasswordResetOtp.mockRejectedValue(new Error('OTP service error'));

            await expect(controller.sendPasswordResetOtp(validSendOtpDto)).rejects.toThrow(
                'OTP service error',
            );
        });

        it('should not catch service errors in sendEmailResetOtp', async () => {
            mockOtpService.sendEmailResetOtp.mockRejectedValue(new Error('OTP service error'));

            await expect(controller.sendEmailResetOtp(validSendOtpDto)).rejects.toThrow(
                'OTP service error',
            );
        });

        it('should not catch service errors in verifyOtp', async () => {
            mockOtpService.verifyOtp.mockRejectedValue(new BadRequestException('Invalid OTP'));

            await expect(controller.verifyOtp(validVerifyOtpRegistrationDto)).rejects.toThrow(
                BadRequestException,
            );
        });
    });
});
