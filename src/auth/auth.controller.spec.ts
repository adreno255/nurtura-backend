import { Test, type TestingModule } from '@nestjs/testing';
import {
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { type EmailQueryDto } from './dto/email-query.dto';
import { type ResetPasswordDto } from './dto/reset-password.dto';

describe('AuthController', () => {
    let controller: AuthController;

    const mockAuthService = {
        getProviders: jest.fn(),
        getOnboardingStatus: jest.fn(),
        resetPassword: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getProviders', () => {
        const dto: EmailQueryDto = { email: 'test@example.com' };

        it('should return sign-in providers', async () => {
            const mockProviders = { providers: ['password', 'google.com'] };
            mockAuthService.getProviders.mockResolvedValue(mockProviders);

            const result = await controller.getProviders(dto);

            expect(result).toEqual(mockProviders);
        });

        it('should call AuthService.getProviders with correct DTO', async () => {
            mockAuthService.getProviders.mockResolvedValue({ providers: ['password'] });

            await controller.getProviders(dto);

            expect(mockAuthService.getProviders).toHaveBeenCalledWith(dto);
        });

        it('should call AuthService.getProviders once', async () => {
            mockAuthService.getProviders.mockResolvedValue({ providers: ['password'] });

            await controller.getProviders(dto);

            expect(mockAuthService.getProviders).toHaveBeenCalledTimes(1);
        });

        it('should return empty providers array', async () => {
            mockAuthService.getProviders.mockResolvedValue({ providers: [] });

            const result = await controller.getProviders(dto);

            expect(result.providers).toEqual([]);
        });

        it('should return multiple providers', async () => {
            const mockProviders = {
                providers: ['password', 'google.com', 'facebook.com'],
            };
            mockAuthService.getProviders.mockResolvedValue(mockProviders);

            const result = await controller.getProviders(dto);

            expect(result.providers).toHaveLength(3);
        });

        it('should propagate NotFoundException from service', async () => {
            mockAuthService.getProviders.mockRejectedValue(
                new NotFoundException('No user found for this email'),
            );

            await expect(controller.getProviders(dto)).rejects.toThrow(NotFoundException);
            await expect(controller.getProviders(dto)).rejects.toThrow('No user found');
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockAuthService.getProviders.mockRejectedValue(
                new InternalServerErrorException('Failed to check sign-in providers'),
            );

            await expect(controller.getProviders(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should work with different email formats', async () => {
            const emails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org'];

            for (const email of emails) {
                mockAuthService.getProviders.mockResolvedValue({ providers: ['password'] });

                const testDto: EmailQueryDto = { email };
                await controller.getProviders(testDto);

                expect(mockAuthService.getProviders).toHaveBeenCalledWith(testDto);
            }
        });
    });

    describe('getOnboardingStatus', () => {
        const dto: EmailQueryDto = { email: 'test@example.com' };

        it('should return needsOnboarding=true', async () => {
            const mockStatus = {
                needsOnboarding: true,
                providers: ['password'],
                message: 'User exists in Firebase, but no profile found in database',
            };
            mockAuthService.getOnboardingStatus.mockResolvedValue(mockStatus);

            const result = await controller.getOnboardingStatus(dto);

            expect(result).toEqual(mockStatus);
        });

        it('should return needsOnboarding=false', async () => {
            const mockStatus = {
                needsOnboarding: false,
                message: 'User profile exists',
            };
            mockAuthService.getOnboardingStatus.mockResolvedValue(mockStatus);

            const result = await controller.getOnboardingStatus(dto);

            expect(result).toEqual(mockStatus);
        });

        it('should call AuthService.getOnboardingStatus with correct DTO', async () => {
            mockAuthService.getOnboardingStatus.mockResolvedValue({
                needsOnboarding: false,
                message: 'User profile exists',
            });

            await controller.getOnboardingStatus(dto);

            expect(mockAuthService.getOnboardingStatus).toHaveBeenCalledWith(dto);
        });

        it('should call AuthService.getOnboardingStatus once', async () => {
            mockAuthService.getOnboardingStatus.mockResolvedValue({
                needsOnboarding: false,
                message: 'User profile exists',
            });

            await controller.getOnboardingStatus(dto);

            expect(mockAuthService.getOnboardingStatus).toHaveBeenCalledTimes(1);
        });

        it('should include providers when needsOnboarding is true', async () => {
            const mockStatus = {
                needsOnboarding: true,
                providers: ['password', 'google.com'],
                message: 'User exists in Firebase, but no profile found in database',
            };
            mockAuthService.getOnboardingStatus.mockResolvedValue(mockStatus);

            const result = await controller.getOnboardingStatus(dto);

            expect(result.providers).toBeDefined();
            expect(result.providers).toHaveLength(2);
        });

        it('should not include providers when needsOnboarding is false', async () => {
            const mockStatus = {
                needsOnboarding: false,
                message: 'User profile exists',
            };
            mockAuthService.getOnboardingStatus.mockResolvedValue(mockStatus);

            const result = await controller.getOnboardingStatus(dto);

            expect(result.providers).toBeUndefined();
        });

        it('should propagate NotFoundException from service', async () => {
            mockAuthService.getOnboardingStatus.mockRejectedValue(
                new NotFoundException('No user found for this email'),
            );

            await expect(controller.getOnboardingStatus(dto)).rejects.toThrow(NotFoundException);
        });

        it('should propagate BadRequestException from service', async () => {
            mockAuthService.getOnboardingStatus.mockRejectedValue(
                new BadRequestException('No sign-in methods found for this user'),
            );

            await expect(controller.getOnboardingStatus(dto)).rejects.toThrow(BadRequestException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockAuthService.getOnboardingStatus.mockRejectedValue(
                new InternalServerErrorException('Failed to check user status'),
            );

            await expect(controller.getOnboardingStatus(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should work with different email formats', async () => {
            const emails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org'];

            for (const email of emails) {
                mockAuthService.getOnboardingStatus.mockResolvedValue({
                    needsOnboarding: false,
                    message: 'User profile exists',
                });

                const testDto: EmailQueryDto = { email };
                await controller.getOnboardingStatus(testDto);

                expect(mockAuthService.getOnboardingStatus).toHaveBeenCalledWith(testDto);
            }
        });
    });

    describe('resetPassword', () => {
        const dto: ResetPasswordDto = {
            email: 'test@example.com',
            newPassword: 'NewSecurePass123!',
        };

        it('should reset password successfully', async () => {
            const mockResponse = { message: 'Password updated successfully' };
            mockAuthService.resetPassword.mockResolvedValue(mockResponse);

            const result = await controller.resetPassword(dto);

            expect(result).toEqual(mockResponse);
        });

        it('should call AuthService.resetPassword with correct DTO', async () => {
            mockAuthService.resetPassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            await controller.resetPassword(dto);

            expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
        });

        it('should call AuthService.resetPassword once', async () => {
            mockAuthService.resetPassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            await controller.resetPassword(dto);

            expect(mockAuthService.resetPassword).toHaveBeenCalledTimes(1);
        });

        it('should work with different passwords', async () => {
            const passwords = ['Pass123!@#', 'MySecure456$', 'Strong789^&*'];

            for (const password of passwords) {
                mockAuthService.resetPassword.mockResolvedValue({
                    message: 'Password updated successfully',
                });

                const testDto: ResetPasswordDto = {
                    email: 'test@example.com',
                    newPassword: password,
                };

                await controller.resetPassword(testDto);

                expect(mockAuthService.resetPassword).toHaveBeenCalledWith(testDto);
            }
        });

        it('should propagate NotFoundException from service', async () => {
            mockAuthService.resetPassword.mockRejectedValue(
                new NotFoundException('No user found for this email'),
            );

            await expect(controller.resetPassword(dto)).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockAuthService.resetPassword.mockRejectedValue(
                new InternalServerErrorException('Failed to reset password'),
            );

            await expect(controller.resetPassword(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should work with different email formats', async () => {
            const emails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org'];

            for (const email of emails) {
                mockAuthService.resetPassword.mockResolvedValue({
                    message: 'Password updated successfully',
                });

                const testDto: ResetPasswordDto = {
                    email,
                    newPassword: 'NewPass123!',
                };

                await controller.resetPassword(testDto);

                expect(mockAuthService.resetPassword).toHaveBeenCalledWith(testDto);
            }
        });

        it('should return message in response', async () => {
            mockAuthService.resetPassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            const result = await controller.resetPassword(dto);

            expect(result).toHaveProperty('message');
            expect(result.message).toBe('Password updated successfully');
        });
    });

    describe('response structure', () => {
        it('should return providers array for getProviders', async () => {
            mockAuthService.getProviders.mockResolvedValue({
                providers: ['password', 'google.com'],
            });

            const result = await controller.getProviders({ email: 'test@example.com' });

            expect(result).toHaveProperty('providers');
            expect(Array.isArray(result.providers)).toBe(true);
        });

        it('should return needsOnboarding boolean for getOnboardingStatus', async () => {
            mockAuthService.getOnboardingStatus.mockResolvedValue({
                needsOnboarding: true,
                providers: ['password'],
                message: 'User exists in Firebase, but no profile found in database',
            });

            const result = await controller.getOnboardingStatus({ email: 'test@example.com' });

            expect(result).toHaveProperty('needsOnboarding');
            expect(typeof result.needsOnboarding).toBe('boolean');
        });

        it('should return message for resetPassword', async () => {
            mockAuthService.resetPassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            const result = await controller.resetPassword({
                email: 'test@example.com',
                newPassword: 'NewPass123!',
            });

            expect(result).toHaveProperty('message');
            expect(typeof result.message).toBe('string');
        });
    });

    describe('integration with AuthService', () => {
        it('should delegate all logic to AuthService', async () => {
            mockAuthService.getProviders.mockResolvedValue({ providers: ['password'] });
            mockAuthService.getOnboardingStatus.mockResolvedValue({
                needsOnboarding: false,
                message: 'User profile exists',
            });
            mockAuthService.resetPassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            await controller.getProviders({ email: 'test@example.com' });
            await controller.getOnboardingStatus({ email: 'test@example.com' });
            await controller.resetPassword({
                email: 'test@example.com',
                newPassword: 'NewPass123!',
            });

            expect(mockAuthService.getProviders).toHaveBeenCalled();
            expect(mockAuthService.getOnboardingStatus).toHaveBeenCalled();
            expect(mockAuthService.resetPassword).toHaveBeenCalled();
        });

        it('should not add additional business logic', async () => {
            // Controller should only wrap service calls
            mockAuthService.getProviders.mockResolvedValue({ providers: ['password'] });

            const dto: EmailQueryDto = { email: 'test@example.com' };
            await controller.getProviders(dto);

            // Should pass DTO directly to service without modification
            expect(mockAuthService.getProviders).toHaveBeenCalledWith(dto);
        });

        it('should return service responses directly', async () => {
            const serviceResponse = {
                providers: ['password', 'google.com'],
            };
            mockAuthService.getProviders.mockResolvedValue(serviceResponse);

            const result = await controller.getProviders({ email: 'test@example.com' });

            expect(result).toBe(serviceResponse);
        });
    });

    describe('error propagation', () => {
        it('should not catch service errors in getProviders', async () => {
            const serviceError = new NotFoundException('User not found');
            mockAuthService.getProviders.mockRejectedValue(serviceError);

            await expect(controller.getProviders({ email: 'test@example.com' })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should not catch service errors in getOnboardingStatus', async () => {
            const serviceError = new BadRequestException('No sign-in methods');
            mockAuthService.getOnboardingStatus.mockRejectedValue(serviceError);

            await expect(
                controller.getOnboardingStatus({ email: 'test@example.com' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should not catch service errors in resetPassword', async () => {
            const serviceError = new InternalServerErrorException('Reset failed');
            mockAuthService.resetPassword.mockRejectedValue(serviceError);

            await expect(
                controller.resetPassword({
                    email: 'test@example.com',
                    newPassword: 'NewPass123!',
                }),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('query parameter handling', () => {
        it('should accept email as query parameter in getProviders', async () => {
            mockAuthService.getProviders.mockResolvedValue({ providers: ['password'] });

            const dto: EmailQueryDto = { email: 'query@example.com' };
            await controller.getProviders(dto);

            expect(mockAuthService.getProviders).toHaveBeenCalledWith(
                expect.objectContaining({ email: 'query@example.com' }),
            );
        });

        it('should accept email as query parameter in getOnboardingStatus', async () => {
            mockAuthService.getOnboardingStatus.mockResolvedValue({
                needsOnboarding: false,
                message: 'User profile exists',
            });

            const dto: EmailQueryDto = { email: 'query@example.com' };
            await controller.getOnboardingStatus(dto);

            expect(mockAuthService.getOnboardingStatus).toHaveBeenCalledWith(
                expect.objectContaining({ email: 'query@example.com' }),
            );
        });
    });

    describe('POST body handling', () => {
        it('should accept request body in resetPassword', async () => {
            mockAuthService.resetPassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            const dto: ResetPasswordDto = {
                email: 'test@example.com',
                newPassword: 'NewPass123!',
            };

            await controller.resetPassword(dto);

            expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
        });

        it('should pass both email and password from body', async () => {
            mockAuthService.resetPassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            const dto: ResetPasswordDto = {
                email: 'body@example.com',
                newPassword: 'BodyPass456!',
            };

            await controller.resetPassword(dto);

            expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'body@example.com',
                    newPassword: 'BodyPass456!',
                }),
            );
        });
    });
});
