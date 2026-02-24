import { Test, type TestingModule } from '@nestjs/testing';
import {
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { type EmailQueryDto } from './dto/email-query.dto';
import { type UpdatePasswordDto } from './dto/update-password.dto';
import {
    expectedOnboardingResponses,
    expectedProviderResponses,
    validEmailQueryDto,
    validUpdatePasswordDto,
} from '../../test/fixtures';

describe('AuthController', () => {
    let controller: AuthController;

    const mockAuthService = {
        getProviders: jest.fn(),
        getOnboardingStatus: jest.fn(),
        updatePassword: jest.fn(),
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
        const dto: EmailQueryDto = validEmailQueryDto;

        it('should return sign-in providers', async () => {
            mockAuthService.getProviders.mockResolvedValue(expectedProviderResponses.multiple);

            const result = await controller.getProviders(dto);

            expect(result).toEqual(expectedProviderResponses.multiple);
        });

        it('should call AuthService.getProviders with correct DTO', async () => {
            mockAuthService.getProviders.mockResolvedValue(expectedProviderResponses.password);

            await controller.getProviders(dto);

            expect(mockAuthService.getProviders).toHaveBeenCalledWith(dto);
        });

        it('should call AuthService.getProviders once', async () => {
            mockAuthService.getProviders.mockResolvedValue(expectedProviderResponses.password);

            await controller.getProviders(dto);

            expect(mockAuthService.getProviders).toHaveBeenCalledTimes(1);
        });

        it('should return empty providers array', async () => {
            mockAuthService.getProviders.mockResolvedValue(expectedProviderResponses.none);

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
        const dto: EmailQueryDto = validEmailQueryDto;

        it('should return needsOnboarding=true', async () => {
            mockAuthService.getOnboardingStatus.mockResolvedValue(
                expectedOnboardingResponses.needsOnboarding,
            );

            const result = await controller.getOnboardingStatus(dto);

            expect(result).toEqual(expectedOnboardingResponses.needsOnboarding);
        });

        it('should return needsOnboarding=false', async () => {
            mockAuthService.getOnboardingStatus.mockResolvedValue(
                expectedOnboardingResponses.onboardingComplete,
            );

            const result = await controller.getOnboardingStatus(dto);

            expect(result).toEqual(expectedOnboardingResponses.onboardingComplete);
        });

        it('should call AuthService.getOnboardingStatus with correct DTO', async () => {
            mockAuthService.getOnboardingStatus.mockResolvedValue(
                expectedOnboardingResponses.onboardingComplete,
            );

            await controller.getOnboardingStatus(dto);

            expect(mockAuthService.getOnboardingStatus).toHaveBeenCalledWith(dto);
        });

        it('should call AuthService.getOnboardingStatus once', async () => {
            mockAuthService.getOnboardingStatus.mockResolvedValue(
                expectedOnboardingResponses.onboardingComplete,
            );

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
            mockAuthService.getOnboardingStatus.mockResolvedValue(
                expectedOnboardingResponses.onboardingComplete,
            );

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

    describe('updatePassword', () => {
        const dto: UpdatePasswordDto = validUpdatePasswordDto;

        it('should reset password successfully', async () => {
            const mockResponse = { message: 'Password updated successfully' };
            mockAuthService.updatePassword.mockResolvedValue(mockResponse);

            const result = await controller.updatePassword(dto);

            expect(result).toEqual(mockResponse);
        });

        it('should call AuthService.updatePassword with correct DTO', async () => {
            mockAuthService.updatePassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            await controller.updatePassword(dto);

            expect(mockAuthService.updatePassword).toHaveBeenCalledWith(dto);
        });

        it('should call AuthService.updatePassword once', async () => {
            mockAuthService.updatePassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            await controller.updatePassword(dto);

            expect(mockAuthService.updatePassword).toHaveBeenCalledTimes(1);
        });

        it('should work with different passwords', async () => {
            const passwords = ['Pass123!@#', 'MySecure456$', 'Strong789^&*'];

            for (const password of passwords) {
                mockAuthService.updatePassword.mockResolvedValue({
                    message: 'Password updated successfully',
                });

                const testDto: UpdatePasswordDto = {
                    email: 'test@example.com',
                    newPassword: password,
                };

                await controller.updatePassword(testDto);

                expect(mockAuthService.updatePassword).toHaveBeenCalledWith(testDto);
            }
        });

        it('should propagate NotFoundException from service', async () => {
            mockAuthService.updatePassword.mockRejectedValue(
                new NotFoundException('No user found for this email'),
            );

            await expect(controller.updatePassword(dto)).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockAuthService.updatePassword.mockRejectedValue(
                new InternalServerErrorException('Failed to reset password'),
            );

            await expect(controller.updatePassword(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should work with different email formats', async () => {
            const emails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org'];

            for (const email of emails) {
                mockAuthService.updatePassword.mockResolvedValue({
                    message: 'Password updated successfully',
                });

                const testDto: UpdatePasswordDto = {
                    email,
                    newPassword: 'NewPass123!',
                };

                await controller.updatePassword(testDto);

                expect(mockAuthService.updatePassword).toHaveBeenCalledWith(testDto);
            }
        });

        it('should return message in response', async () => {
            mockAuthService.updatePassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            const result = await controller.updatePassword(dto);

            expect(result).toHaveProperty('message');
            expect(result.message).toBe('Password updated successfully');
        });
    });

    describe('response structure', () => {
        it('should return providers array for getProviders', async () => {
            mockAuthService.getProviders.mockResolvedValue(expectedProviderResponses.multiple);

            const result = await controller.getProviders(validEmailQueryDto);

            expect(result).toHaveProperty('providers');
            expect(Array.isArray(result.providers)).toBe(true);
        });

        it('should return needsOnboarding boolean for getOnboardingStatus', async () => {
            mockAuthService.getOnboardingStatus.mockResolvedValue(
                expectedOnboardingResponses.needsOnboarding,
            );

            const result = await controller.getOnboardingStatus(validEmailQueryDto);

            expect(result).toHaveProperty('needsOnboarding');
            expect(typeof result.needsOnboarding).toBe('boolean');
        });

        it('should return message for updatePassword', async () => {
            mockAuthService.updatePassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            const result = await controller.updatePassword(validUpdatePasswordDto);

            expect(result).toHaveProperty('message');
            expect(typeof result.message).toBe('string');
        });
    });

    describe('integration with AuthService', () => {
        it('should delegate all logic to AuthService', async () => {
            mockAuthService.getProviders.mockResolvedValue(expectedProviderResponses.password);
            mockAuthService.getOnboardingStatus.mockResolvedValue(
                expectedOnboardingResponses.onboardingComplete,
            );
            mockAuthService.updatePassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            await controller.getProviders(validEmailQueryDto);
            await controller.getOnboardingStatus(validEmailQueryDto);
            await controller.updatePassword(validUpdatePasswordDto);

            expect(mockAuthService.getProviders).toHaveBeenCalled();
            expect(mockAuthService.getOnboardingStatus).toHaveBeenCalled();
            expect(mockAuthService.updatePassword).toHaveBeenCalled();
        });

        it('should not add additional business logic', async () => {
            // Controller should only wrap service calls
            mockAuthService.getProviders.mockResolvedValue(expectedProviderResponses.password);

            await controller.getProviders(validEmailQueryDto);

            // Should pass DTO directly to service without modification
            expect(mockAuthService.getProviders).toHaveBeenCalledWith(validEmailQueryDto);
        });

        it('should return service responses directly', async () => {
            const serviceResponse = expectedProviderResponses.multiple;

            mockAuthService.getProviders.mockResolvedValue(serviceResponse);

            const result = await controller.getProviders(validEmailQueryDto);

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

        it('should not catch service errors in updatePassword', async () => {
            const serviceError = new InternalServerErrorException('Reset failed');
            mockAuthService.updatePassword.mockRejectedValue(serviceError);

            await expect(controller.updatePassword(validUpdatePasswordDto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    describe('query parameter handling', () => {
        it('should accept email as query parameter in getProviders', async () => {
            mockAuthService.getProviders.mockResolvedValue(expectedProviderResponses.password);

            await controller.getProviders(validEmailQueryDto);

            expect(mockAuthService.getProviders).toHaveBeenCalledWith(
                expect.objectContaining({ email: 'test@example.com' }),
            );
        });

        it('should accept email as query parameter in getOnboardingStatus', async () => {
            mockAuthService.getOnboardingStatus.mockResolvedValue(
                expectedOnboardingResponses.onboardingComplete,
            );

            await controller.getOnboardingStatus(validEmailQueryDto);

            expect(mockAuthService.getOnboardingStatus).toHaveBeenCalledWith(
                expect.objectContaining({ email: 'test@example.com' }),
            );
        });
    });

    describe('POST body handling', () => {
        it('should accept request body in updatePassword', async () => {
            mockAuthService.updatePassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            await controller.updatePassword(validUpdatePasswordDto);

            expect(mockAuthService.updatePassword).toHaveBeenCalledWith(validUpdatePasswordDto);
        });

        it('should pass both email and password from body', async () => {
            mockAuthService.updatePassword.mockResolvedValue({
                message: 'Password updated successfully',
            });

            await controller.updatePassword(validUpdatePasswordDto);

            expect(mockAuthService.updatePassword).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'test@example.com',
                    newPassword: 'NewSecurePass123!',
                }),
            );
        });
    });
});
