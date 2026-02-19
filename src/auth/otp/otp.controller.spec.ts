import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { type SendOtpRequestDto } from './dto/send-otp-request.dto';
import { type VerifyOtpDto } from './dto/verify-otp.dto';
import {
    validEmailQueryDto,
    validSendOtpDto,
    validVerifyOtpPasswordResetDto,
    validVerifyOtpRegistrationDto,
} from '../../../test/fixtures';
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

            expect(result).toEqual({
                message: 'Registration OTP sent successfully. Please check your email.',
            });
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
            const serviceError = new Error('Service error');
            mockOtpService.sendRegistrationOtp.mockRejectedValue(serviceError);

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

    describe('sendPasswordResetOtp', () => {
        const dto: SendOtpRequestDto = validSendOtpDto;

        it('should send forgot password OTP successfully', async () => {
            mockOtpService.sendPasswordResetOtp.mockResolvedValue(undefined);

            const result = await controller.sendPasswordResetOtp(dto);

            expect(result).toEqual({
                message: 'Password reset OTP sent successfully. Please check your email.',
            });
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
            const serviceError = new Error('Service error');
            mockOtpService.sendPasswordResetOtp.mockRejectedValue(serviceError);

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

            expect(result).toEqual({
                message: 'Email reset OTP sent successfully. Please check your email.',
            });
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
            const serviceError = new Error('Service error');
            mockOtpService.sendEmailResetOtp.mockRejectedValue(serviceError);

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

        it('should verify OTP successfully', () => {
            mockOtpService.verifyOtp.mockReturnValue(undefined);

            const result = controller.verifyOtp(dto);

            expect(result).toEqual({
                message: 'OTP verified successfully.',
            });
        });

        it('should call OtpService.verifyOtp with correct DTO', () => {
            mockOtpService.verifyOtp.mockReturnValue(undefined);

            controller.verifyOtp(dto);

            expect(mockOtpService.verifyOtp).toHaveBeenCalledWith(dto);
        });

        it('should call OtpService.verifyOtp once', () => {
            mockOtpService.verifyOtp.mockReturnValue(undefined);

            controller.verifyOtp(dto);

            expect(mockOtpService.verifyOtp).toHaveBeenCalledTimes(1);
        });

        it('should propagate service errors', () => {
            const serviceError = new BadRequestException('Invalid OTP');
            mockOtpService.verifyOtp.mockImplementation(() => {
                throw serviceError;
            });

            expect(() => controller.verifyOtp(dto)).toThrow(BadRequestException);
            expect(() => controller.verifyOtp(dto)).toThrow('Invalid OTP');
        });

        it('should handle expired OTP error', () => {
            mockOtpService.verifyOtp.mockImplementation(() => {
                throw new BadRequestException('OTP has expired. Please request a new one.');
            });

            expect(() => controller.verifyOtp(dto)).toThrow(BadRequestException);
            expect(() => controller.verifyOtp(dto)).toThrow('OTP has expired');
        });

        it('should handle OTP not found error', () => {
            mockOtpService.verifyOtp.mockImplementation(() => {
                throw new BadRequestException('No OTP found for this email');
            });

            expect(() => controller.verifyOtp(dto)).toThrow(BadRequestException);
            expect(() => controller.verifyOtp(dto)).toThrow('No OTP found');
        });

        it('should handle purpose mismatch error', () => {
            mockOtpService.verifyOtp.mockImplementation(() => {
                throw new BadRequestException('Invalid OTP context');
            });

            expect(() => controller.verifyOtp(dto)).toThrow(BadRequestException);
            expect(() => controller.verifyOtp(dto)).toThrow('Invalid OTP context');
        });

        it('should return consistent message format', () => {
            mockOtpService.verifyOtp.mockReturnValue(undefined);

            const result = controller.verifyOtp(dto);

            expect(result).toHaveProperty('message');
            expect(typeof result.message).toBe('string');
        });

        it('should verify registration OTP', () => {
            mockOtpService.verifyOtp.mockReturnValue(undefined);

            const result = controller.verifyOtp(validVerifyOtpRegistrationDto);

            expect(result.message).toBe('OTP verified successfully.');
        });

        it('should verify forgot-password OTP', () => {
            mockOtpService.verifyOtp.mockReturnValue(undefined);

            const result = controller.verifyOtp(validVerifyOtpPasswordResetDto);

            expect(result.message).toBe('OTP verified successfully.');
        });

        it('should work with different OTP codes', () => {
            const codes = ['12345', '00000', '99999', '54321'];

            for (const code of codes) {
                mockOtpService.verifyOtp.mockReturnValue(undefined);

                const testDto: VerifyOtpDto = {
                    email: 'test@example.com',
                    code,
                    purpose: 'registration',
                };

                controller.verifyOtp(testDto);

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

        it('should return object with message property for verifyOtp', () => {
            mockOtpService.verifyOtp.mockReturnValue(undefined);

            const result = controller.verifyOtp(validVerifyOtpRegistrationDto);

            expect(Object.keys(result)).toEqual(['message']);
        });
    });

    describe('integration with OtpService', () => {
        it('should delegate all logic to OtpService', async () => {
            mockOtpService.sendRegistrationOtp.mockResolvedValue(undefined);
            mockOtpService.sendPasswordResetOtp.mockResolvedValue(undefined);
            mockOtpService.sendEmailResetOtp.mockResolvedValue(undefined);
            mockOtpService.verifyOtp.mockReturnValue(undefined);

            await controller.sendRegistrationOtp(validEmailQueryDto);
            await controller.sendPasswordResetOtp(validEmailQueryDto);
            await controller.sendEmailResetOtp(validEmailQueryDto);
            controller.verifyOtp(validVerifyOtpRegistrationDto);

            expect(mockOtpService.sendRegistrationOtp).toHaveBeenCalled();
            expect(mockOtpService.sendPasswordResetOtp).toHaveBeenCalled();
            expect(mockOtpService.sendEmailResetOtp).toHaveBeenCalled();
            expect(mockOtpService.verifyOtp).toHaveBeenCalled();
        });

        it('should not add additional business logic', async () => {
            // Controller should only wrap service calls with response formatting
            mockOtpService.sendRegistrationOtp.mockResolvedValue(undefined);

            await controller.sendRegistrationOtp(validSendOtpDto);

            // Should pass DTO directly to service without modification
            expect(mockOtpService.sendRegistrationOtp).toHaveBeenCalledWith(validSendOtpDto);
        });
    });

    describe('error propagation', () => {
        it('should not catch service errors in sendRegistrationOtp', async () => {
            const serviceError = new Error('OTP service error');
            mockOtpService.sendRegistrationOtp.mockRejectedValue(serviceError);

            await expect(controller.sendRegistrationOtp(validSendOtpDto)).rejects.toThrow(
                'OTP service error',
            );
        });

        it('should not catch service errors in sendPasswordResetOtp', async () => {
            const serviceError = new Error('OTP service error');
            mockOtpService.sendPasswordResetOtp.mockRejectedValue(serviceError);

            await expect(controller.sendPasswordResetOtp(validSendOtpDto)).rejects.toThrow(
                'OTP service error',
            );
        });

        it('should not catch service errors in sendEmailResetOtp', async () => {
            const serviceError = new Error('OTP service error');
            mockOtpService.sendEmailResetOtp.mockRejectedValue(serviceError);

            await expect(controller.sendEmailResetOtp(validSendOtpDto)).rejects.toThrow(
                'OTP service error',
            );
        });

        it('should not catch service errors in verifyOtp', () => {
            const serviceError = new BadRequestException('Invalid OTP');
            mockOtpService.verifyOtp.mockImplementation(() => {
                throw serviceError;
            });

            expect(() => controller.verifyOtp(validVerifyOtpRegistrationDto)).toThrow(
                BadRequestException,
            );
        });
    });
});
