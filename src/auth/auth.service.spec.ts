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
import { type ResetPasswordDto } from './dto/reset-password.dto';

describe('AuthService', () => {
    let service: AuthService;

    const mockFirebaseAuth = {
        getUserByEmail: jest.fn(),
        updateUser: jest.fn(),
        verifyIdToken: jest.fn(),
    };

    const mockFirebaseService = {
        getAuth: jest.fn(() => mockFirebaseAuth),
    };

    const mockDatabaseService = {
        user: {
            findUnique: jest.fn(),
        },
    };

    const mockLoggerService = {
        bootstrap: jest.fn(),
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    };

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
        const testEmail = 'test@example.com';
        const dto: EmailQueryDto = { email: testEmail };

        it('should return sign-in providers for existing user', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
                providerData: [{ providerId: 'password' }, { providerId: 'google.com' }],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);

            const result = await service.getProviders(dto);

            expect(result).toEqual({
                providers: ['password', 'google.com'],
            });
        });

        it('should call Firebase Auth with correct email', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
                providerData: [{ providerId: 'password' }],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);

            await service.getProviders(dto);

            expect(mockFirebaseAuth.getUserByEmail).toHaveBeenCalledWith(testEmail);
        });

        it('should log providers found', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
                providerData: [{ providerId: 'password' }, { providerId: 'google.com' }],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);

            await service.getProviders(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Sign-in providers found for ${testEmail}: password, google.com`,
                'AuthService',
            );
        });

        it('should throw NotFoundException if user not found', async () => {
            const firebaseError = new Error('User not found');
            Object.assign(firebaseError, { code: 'auth/user-not-found' });

            mockFirebaseAuth.getUserByEmail.mockRejectedValue(firebaseError);

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
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
                providerData: [],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);

            const result = await service.getProviders(dto);

            expect(result).toEqual({
                providers: [],
            });
        });

        it('should handle user with single provider', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
                providerData: [{ providerId: 'password' }],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);

            const result = await service.getProviders(dto);

            expect(result).toEqual({
                providers: ['password'],
            });
        });
    });

    describe('getOnboardingStatus', () => {
        const testEmail = 'test@example.com';
        const dto: EmailQueryDto = { email: testEmail };

        it('should return needsOnboarding=true if user not in database', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
                providerData: [{ providerId: 'password' }],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            const result = await service.getOnboardingStatus(dto);

            expect(result).toEqual({
                needsOnboarding: true,
                providers: ['password'],
                message: 'User exists in Firebase, but no profile found in database',
            });
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

            expect(result).toEqual({
                needsOnboarding: false,
                message: 'User profile exists',
            });
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
            const firebaseError = new Error('User not found');
            Object.assign(firebaseError, { code: 'auth/user-not-found' });

            mockFirebaseAuth.getUserByEmail.mockRejectedValue(firebaseError);

            await expect(service.getOnboardingStatus(dto)).rejects.toThrow(NotFoundException);
            await expect(service.getOnboardingStatus(dto)).rejects.toThrow(
                'No user found for this email',
            );
        });

        it('should throw BadRequestException if no sign-in methods found', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
                providerData: [],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);

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
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
                providerData: [{ providerId: 'password' }],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await expect(service.getOnboardingStatus(dto)).resolves.not.toThrow();
        });
    });

    describe('resetPassword', () => {
        const testEmail = 'test@example.com';
        const newPassword = 'NewSecurePass123!';
        const dto: ResetPasswordDto = { email: testEmail, newPassword };

        it('should reset password successfully', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockFirebaseAuth.updateUser.mockResolvedValue(undefined);

            const result = await service.resetPassword(dto);

            expect(result).toEqual({
                message: 'Password updated successfully',
            });
        });

        it('should call getUserByEmail with correct email', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockFirebaseAuth.updateUser.mockResolvedValue(undefined);

            await service.resetPassword(dto);

            expect(mockFirebaseAuth.getUserByEmail).toHaveBeenCalledWith(testEmail);
        });

        it('should call updateUser with correct uid and password', async () => {
            const mockUser = {
                uid: 'test-uid-123',
                email: testEmail,
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockFirebaseAuth.updateUser.mockResolvedValue(undefined);

            await service.resetPassword(dto);

            expect(mockFirebaseAuth.updateUser).toHaveBeenCalledWith('test-uid-123', {
                password: newPassword,
            });
        });

        it('should log success message', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockFirebaseAuth.updateUser.mockResolvedValue(undefined);

            await service.resetPassword(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Password reset successfully for ${testEmail}`,
                'AuthService',
            );
        });

        it('should throw NotFoundException if user not found', async () => {
            const firebaseError = new Error('User not found');
            Object.assign(firebaseError, { code: 'auth/user-not-found' });

            mockFirebaseAuth.getUserByEmail.mockRejectedValue(firebaseError);

            await expect(service.resetPassword(dto)).rejects.toThrow(NotFoundException);
            await expect(service.resetPassword(dto)).rejects.toThrow(
                'No user found for this email',
            );
        });

        it('should throw InternalServerErrorException for other errors', async () => {
            const genericError = new Error('Firebase error');
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(genericError);

            await expect(service.resetPassword(dto)).rejects.toThrow(InternalServerErrorException);
            await expect(service.resetPassword(dto)).rejects.toThrow('Failed to reset password');
        });

        it('should log error on failure', async () => {
            const genericError = new Error('Firebase error');
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(genericError);

            await expect(service.resetPassword(dto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error resetting password for ${testEmail}`,
                'Firebase error',
                'AuthService',
            );
        });

        it('should handle updateUser failure', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockFirebaseAuth.updateUser.mockRejectedValue(new Error('Update failed'));

            await expect(service.resetPassword(dto)).rejects.toThrow(InternalServerErrorException);
        });

        it('should handle Firebase auth errors in updateUser', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: testEmail,
            };

            const firebaseError = {
                code: 'auth/weak-password',
                message: 'Password is too weak',
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockFirebaseAuth.updateUser.mockRejectedValue(firebaseError);

            await expect(service.resetPassword(dto)).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('Firebase error type guard', () => {
        it('should correctly identify Firebase auth errors', async () => {
            const firebaseError = new Error('User not found');
            Object.assign(firebaseError, { code: 'auth/user-not-found' });

            mockFirebaseAuth.getUserByEmail.mockRejectedValue(firebaseError);

            await expect(service.getProviders({ email: 'test@example.com' })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should handle non-Firebase errors', async () => {
            const genericError = new Error('Generic error');
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(genericError);

            await expect(service.getProviders({ email: 'test@example.com' })).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should handle string errors', async () => {
            mockFirebaseAuth.getUserByEmail.mockRejectedValue('String error');

            await expect(service.getProviders({ email: 'test@example.com' })).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    describe('integration', () => {
        it('should work with FirebaseService', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue({
                email: 'test@example.com',
                providerData: [],
            });

            await service.getProviders({ email: 'test@example.com' });

            expect(mockFirebaseService.getAuth).toHaveBeenCalled();
        });

        it('should work with DatabaseService for onboarding check', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: 'test@example.com',
                providerData: [{ providerId: 'password' }],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await service.getOnboardingStatus({ email: 'test@example.com' });

            expect(mockDatabaseService.user.findUnique).toHaveBeenCalled();
        });

        it('should use logger for all operations', async () => {
            const mockUser = {
                uid: 'test-uid',
                email: 'test@example.com',
                providerData: [{ providerId: 'password' }],
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);

            await service.getProviders({ email: 'test@example.com' });

            expect(mockLoggerService.log).toHaveBeenCalled();
        });
    });
});
