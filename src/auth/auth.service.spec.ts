import { Test, type TestingModule } from '@nestjs/testing';
import {
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { FirebaseService } from '../firebase/firebase.service';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { type EmailQueryDto } from './dto/email-query.dto';
import { type UpdatePasswordDto } from './dto/update-password.dto';
import {
    createMockDatabaseService,
    createMockFirebaseAuth,
    createMockFirebaseService,
    createMockLogger,
    FirebaseAuthErrors,
} from '../../test/mocks';
import {
    expectedOnboardingResponses,
    expectedProviderResponses,
    mockFirebaseUserNoProviders,
    mockFirebaseUserWithMultipleProviders,
    mockFirebaseUserWithPassword,
    testEmails,
    testFirebaseUids,
    testUserIds,
    validEmailQueryDto,
    validUpdatePasswordDto,
} from '../../test/fixtures';
import { type CurrentUserPayload } from '../common/interfaces';

describe('AuthService', () => {
    let service: AuthService;

    const mockFirebaseAuth = createMockFirebaseAuth();

    const mockFirebaseService = createMockFirebaseService(mockFirebaseAuth);

    const mockDatabaseService = createMockDatabaseService();

    const mockLoggerService = createMockLogger();

    const testEmail = testEmails.valid;
    const emailQueryDto = validEmailQueryDto;
    const UpdatePasswordDto = validUpdatePasswordDto;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: FirebaseService,
                    useValue: mockFirebaseService,
                },
                {
                    provide: DatabaseService,
                    useValue: mockDatabaseService,
                },
                {
                    provide: MyLoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getProviders', () => {
        const dto: EmailQueryDto = emailQueryDto;

        it('should return sign-in providers for existing user', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(
                mockFirebaseUserWithMultipleProviders,
            );

            const result = await service.getProviders(dto);

            expect(result).toEqual(expectedProviderResponses.multiple);
        });

        it('should call Firebase Auth with correct email', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockFirebaseUserWithPassword);

            await service.getProviders(dto);

            expect(mockFirebaseAuth.getUserByEmail).toHaveBeenCalledWith(testEmail);
        });

        it('should log providers found', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(
                mockFirebaseUserWithMultipleProviders,
            );

            await service.getProviders(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Sign-in providers found for ${testEmail}: password, google.com`,
                'AuthService',
            );
        });

        it('should throw NotFoundException if user not found', async () => {
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            await expect(service.getProviders(dto)).rejects.toThrow(NotFoundException);
            await expect(service.getProviders(dto)).rejects.toThrow('No user found for this email');
        });

        it('should throw InternalServerErrorException for other errors', async () => {
            const genericError = new Error('Firebase error');
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(genericError);

            await expect(service.getProviders(dto)).rejects.toThrow(InternalServerErrorException);
            await expect(service.getProviders(dto)).rejects.toThrow(
                'Failed to check sign-in providers',
            );
        });

        it('should log error for other errors', async () => {
            const genericError = new Error('Firebase error');
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(genericError);

            await expect(service.getProviders(dto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error checking sign-in providers for ${testEmail}`,
                'Firebase error',
                'AuthService',
            );
        });

        it('should handle user with no providers', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockFirebaseUserNoProviders);

            const result = await service.getProviders(dto);

            expect(result).toEqual(expectedProviderResponses.none);
        });

        it('should handle user with single provider', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockFirebaseUserWithPassword);

            const result = await service.getProviders(dto);

            expect(result).toEqual(expectedProviderResponses.password);
        });
    });

    describe('getOnboardingStatus', () => {
        const dto: EmailQueryDto = emailQueryDto;

        it('should return needsOnboarding=true if user not in database', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockFirebaseUserWithPassword);
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            const result = await service.getOnboardingStatus(dto);

            expect(result).toEqual(expectedOnboardingResponses.needsOnboarding);
        });

        it('should return needsOnboarding=false if user exists in database', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
                providerData: [{ providerId: 'password' }],
            };

            const mockDbUser = {
                id: 'db-user-id',
                firebaseUid: 'test-uid',
                email: testEmail,
                firstName: 'Test',
                lastName: 'User',
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockDatabaseService.user.findUnique.mockResolvedValue(mockDbUser);

            const result = await service.getOnboardingStatus(dto);

            expect(result).toEqual(expectedOnboardingResponses.onboardingComplete);
        });

        it('should query database with Firebase UID', async () => {
            const mockUser = {
                uid: 'test-uid-123',
                email: testEmail,
                providerData: [{ providerId: 'password' }],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await service.getOnboardingStatus(dto);

            expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
                where: { firebaseUid: 'test-uid-123' },
            });
        });

        it('should log when user needs onboarding', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
                providerData: [{ providerId: 'password' }],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await service.getOnboardingStatus(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `User needs onboarding: ${testEmail}`,
                'AuthService',
            );
        });

        it('should log when user onboarding is complete', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
                providerData: [{ providerId: 'password' }],
            };

            const mockDbUser = {
                id: 'db-user-id',
                firebaseUid: 'test-uid',
                email: testEmail,
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockDatabaseService.user.findUnique.mockResolvedValue(mockDbUser);

            await service.getOnboardingStatus(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `User onboarding complete: ${testEmail}`,
                'AuthService',
            );
        });

        it('should throw NotFoundException if user not found in Firebase', async () => {
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            await expect(service.getOnboardingStatus(dto)).rejects.toThrow(NotFoundException);
            await expect(service.getOnboardingStatus(dto)).rejects.toThrow(
                'No user found for this email',
            );
        });

        it('should throw BadRequestException if no sign-in methods found', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockFirebaseUserNoProviders);

            await expect(service.getOnboardingStatus(dto)).rejects.toThrow(BadRequestException);
            await expect(service.getOnboardingStatus(dto)).rejects.toThrow(
                'No sign-in methods found for this user',
            );
        });

        it('should throw InternalServerErrorException for other errors', async () => {
            const genericError = new Error('Database error');
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(genericError);

            await expect(service.getOnboardingStatus(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.getOnboardingStatus(dto)).rejects.toThrow(
                'Failed to check user status',
            );
        });

        it('should log error for other errors', async () => {
            const genericError = new Error('Database error');
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(genericError);

            await expect(service.getOnboardingStatus(dto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error checking onboarding status for ${testEmail}`,
                'Database error',
                'AuthService',
            );
        });

        it('should not throw BadRequestException error if providers exist', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockFirebaseUserWithPassword);
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await expect(service.getOnboardingStatus(dto)).resolves.not.toThrow();
        });
    });

    describe('updatePassword', () => {
        const currentUser: CurrentUserPayload = {
            dbId: testUserIds.primary,
            firebaseUid: testFirebaseUids.primary,
            email: testEmails.valid,
        };
        const dto: UpdatePasswordDto = UpdatePasswordDto;

        it('should reset password successfully', async () => {
            mockFirebaseAuth.updateUser.mockResolvedValue(undefined);

            const result = await service.updatePassword(currentUser, dto);

            expect(result).toEqual({
                message: 'Password updated successfully',
            });
        });

        it('should call updateUser with correct uid and password', async () => {
            mockFirebaseAuth.updateUser.mockResolvedValue(undefined);

            await service.updatePassword(currentUser, dto);

            expect(mockFirebaseAuth.updateUser).toHaveBeenCalledWith('test-firebase-uid', {
                password: dto.newPassword,
            });
        });

        it('should log success message', async () => {
            mockFirebaseAuth.updateUser.mockResolvedValue(undefined);

            await service.updatePassword(currentUser, dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Password reset successfully for ${testEmail}`,
                'AuthService',
            );
        });

        it('should throw NotFoundException if user not found', async () => {
            mockFirebaseAuth.updateUser.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            await expect(service.updatePassword(currentUser, dto)).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.updatePassword(currentUser, dto)).rejects.toThrow(
                'No user found for this email',
            );
        });

        it('should throw InternalServerErrorException for other errors', async () => {
            const genericError = new Error('Firebase error');
            mockFirebaseAuth.updateUser.mockRejectedValue(genericError);

            await expect(service.updatePassword(currentUser, dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.updatePassword(currentUser, dto)).rejects.toThrow(
                'Failed to reset password',
            );
        });

        it('should log error on failure', async () => {
            const genericError = new Error('Firebase error');
            mockFirebaseAuth.updateUser.mockRejectedValue(genericError);

            await expect(service.updatePassword(currentUser, dto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error resetting password for ${testEmail}`,
                'Firebase error',
                'AuthService',
            );
        });

        it('should handle updateUser failure', async () => {
            mockFirebaseAuth.updateUser.mockRejectedValue(new Error('Update failed'));

            await expect(service.updatePassword(currentUser, dto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should handle Firebase auth errors in updateUser', async () => {
            mockFirebaseAuth.updateUser.mockRejectedValue(FirebaseAuthErrors.invalidPassword());

            await expect(service.updatePassword(currentUser, dto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    describe('Firebase error type guard', () => {
        it('should correctly identify Firebase auth errors', async () => {
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            await expect(service.getProviders(emailQueryDto)).rejects.toThrow(NotFoundException);
        });

        it('should handle non-Firebase errors', async () => {
            const genericError = new Error('Generic error');
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(genericError);

            await expect(service.getProviders(emailQueryDto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should handle string errors', async () => {
            mockFirebaseAuth.getUserByEmail.mockRejectedValue('String error');

            await expect(service.getProviders(emailQueryDto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    describe('integration', () => {
        it('should work with FirebaseService', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockFirebaseUserNoProviders);

            await service.getProviders(emailQueryDto);

            expect(mockFirebaseService.getAuth).toHaveBeenCalled();
        });

        it('should work with DatabaseService for onboarding check', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockFirebaseUserWithPassword);
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await service.getOnboardingStatus(emailQueryDto);

            expect(mockDatabaseService.user.findUnique).toHaveBeenCalled();
        });

        it('should use logger for all operations', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockFirebaseUserWithPassword);

            await service.getProviders(emailQueryDto);

            expect(mockLoggerService.log).toHaveBeenCalled();
        });
    });
});
