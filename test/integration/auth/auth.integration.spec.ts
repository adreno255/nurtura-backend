import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from '../../../src/auth/auth.service';
import { FirebaseService } from '../../../src/firebase/firebase.service';
import { DatabaseService } from '../../../src/database/database.service';
import { MyLoggerService } from '../../../src/my-logger/my-logger.service';
import { TestDatabaseHelper, TestDataHelper } from '../../helpers';
import { createMockFirebaseService, FirebaseAuthErrors } from '../../mocks/firebase.mock';
import { envValidationSchema } from '../../../src/config/env.validation';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AuthService Integration Tests', () => {
    let app: INestApplication;
    let authService: AuthService;
    let databaseService: DatabaseService;
    let dbHelper: TestDatabaseHelper;

    // Mock Firebase (external service)
    const mockFirebaseService = createMockFirebaseService();

    beforeAll(async () => {
        // Initialize database helper
        dbHelper = new TestDatabaseHelper();
        await dbHelper.connect();

        // Create testing module with real database but mocked Firebase
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.test',
                    validationSchema: envValidationSchema,
                }),
            ],
            providers: [
                AuthService,
                DatabaseService,
                MyLoggerService,
                {
                    provide: FirebaseService,
                    useValue: mockFirebaseService,
                },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        authService = moduleFixture.get<AuthService>(AuthService);
        databaseService = moduleFixture.get<DatabaseService>(DatabaseService);
    });

    afterAll(async () => {
        await dbHelper.clearDatabase();
        await dbHelper.disconnect();
        await app.close();
    });

    beforeEach(async () => {
        // Clean database before each test
        await dbHelper.clearDatabase();
        jest.clearAllMocks();
    });

    describe('getProviders', () => {
        it('should return sign-in providers for existing Firebase user', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Mock Firebase response
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: 'test-uid',
                email,
                providerData: ['password', 'google.com'],
            });

            const result = await authService.getProviders({ email });

            expect(result).toEqual({
                providers: ['password', 'google.com'],
            });
            expect(mockFirebaseService.getAuth().getUserByEmail).toHaveBeenCalledWith(email);
        });

        it('should throw NotFoundException when Firebase user does not exist', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Mock Firebase user not found error
            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            await expect(authService.getProviders({ email })).rejects.toThrow(NotFoundException);
            await expect(authService.getProviders({ email })).rejects.toThrow(
                'No user found for this email',
            );
        });

        it('should handle Firebase user with single provider', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: 'test-uid',
                email,
                providerData: ['password'],
            });

            const result = await authService.getProviders({ email });

            expect(result).toEqual({
                providers: ['password'],
            });
        });

        it('should handle Firebase user with no providers', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: 'test-uid',
                email,
                providerData: [],
            });

            const result = await authService.getProviders({ email });

            expect(result).toEqual({
                providers: [],
            });
        });
    });

    describe('getOnboardingStatus', () => {
        it('should return needsOnboarding=true when user exists in Firebase but not in database', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Mock Firebase response
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }],
            });

            // User does not exist in database (real database check)
            const dbUser = await databaseService.user.findUnique({
                where: { firebaseUid },
            });
            expect(dbUser).toBeNull();

            const result = await authService.getOnboardingStatus({ email });

            expect(result).toEqual({
                needsOnboarding: true,
                providers: ['password'],
                message: 'User exists in Firebase, but no profile found in database',
            });
        });

        it('should return needsOnboarding=false when user exists in both Firebase and database', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Mock Firebase response
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }],
            });

            // Create user in real database
            await databaseService.user.create({
                data: {
                    firebaseUid,
                    email,
                    firstName: 'John',
                    lastName: 'Doe',
                    address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
                },
            });

            const result = await authService.getOnboardingStatus({ email });

            expect(result).toEqual({
                needsOnboarding: false,
                message: 'User profile exists',
            });
        });

        it('should throw BadRequestException when Firebase user has no sign-in methods', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Mock Firebase response with no providers
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: [],
            });

            await expect(authService.getOnboardingStatus({ email })).rejects.toThrow(
                BadRequestException,
            );
            await expect(authService.getOnboardingStatus({ email })).rejects.toThrow(
                'No sign-in methods found for this user',
            );
        });

        it('should throw NotFoundException when Firebase user does not exist', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Mock Firebase user not found error
            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            await expect(authService.getOnboardingStatus({ email })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should work with user created with different address format', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            // Mock Firebase response
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'google.com' }],
            });

            // Create user with generated data
            await databaseService.user.create({
                data: {
                    firebaseUid,
                    email,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    address: `${userData.block}, ${userData.street}, ${userData.barangay}, ${userData.city}`,
                },
            });

            const result = await authService.getOnboardingStatus({ email });

            expect(result.needsOnboarding).toBe(false);
        });
    });

    describe('resetPassword', () => {
        it('should reset password successfully for existing Firebase user', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const newPassword = TestDataHelper.generateStrongPassword();

            // Mock Firebase getUserByEmail
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
            });

            // Mock Firebase updateUser
            mockFirebaseService.getAuth().updateUser.mockResolvedValue({
                uid: firebaseUid,
                email,
            });

            const result = await authService.resetPassword({ email, newPassword });

            expect(result).toEqual({
                message: 'Password updated successfully',
            });
            expect(mockFirebaseService.getAuth().updateUser).toHaveBeenCalledWith(firebaseUid, {
                password: newPassword,
            });
        });

        it('should throw NotFoundException when Firebase user does not exist', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const newPassword = TestDataHelper.generateStrongPassword();

            // Mock Firebase user not found error
            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            await expect(authService.resetPassword({ email, newPassword })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should handle Firebase updateUser failures gracefully', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const newPassword = TestDataHelper.generateStrongPassword();

            // Mock Firebase getUserByEmail success
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
            });

            // Mock Firebase updateUser failure
            mockFirebaseService
                .getAuth()
                .updateUser.mockRejectedValue(new Error('Firebase update failed'));

            await expect(authService.resetPassword({ email, newPassword })).rejects.toThrow(
                'Failed to reset password',
            );
        });

        it('should work with multiple password resets for same user', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Mock Firebase responses
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
            });
            mockFirebaseService.getAuth().updateUser.mockResolvedValue({
                uid: firebaseUid,
                email,
            });

            // First password reset
            const password1 = TestDataHelper.generateStrongPassword();
            const result1 = await authService.resetPassword({ email, newPassword: password1 });
            expect(result1.message).toBe('Password updated successfully');

            // Second password reset
            const password2 = TestDataHelper.generateStrongPassword();
            const result2 = await authService.resetPassword({ email, newPassword: password2 });
            expect(result2.message).toBe('Password updated successfully');

            // Verify updateUser was called twice
            expect(mockFirebaseService.getAuth().updateUser).toHaveBeenCalledTimes(2);
        });
    });

    describe('database integration', () => {
        it('should query real database for user existence', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Mock Firebase response
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }],
            });

            // Initially user should not exist
            const result1 = await authService.getOnboardingStatus({ email });
            expect(result1.needsOnboarding).toBe(true);

            // Create user in real database
            await databaseService.user.create({
                data: {
                    firebaseUid,
                    email,
                    firstName: 'Test',
                    lastName: 'User',
                    address: 'Test Address',
                },
            });

            // Now user should exist
            const result2 = await authService.getOnboardingStatus({ email });
            expect(result2.needsOnboarding).toBe(false);
        });

        it('should handle concurrent database operations correctly', async () => {
            const users = Array.from({ length: 5 }, () => ({
                email: TestDataHelper.generateRandomEmail(),
                firebaseUid: TestDataHelper.generateFirebaseUid(),
            }));

            // Mock Firebase responses for all users
            users.forEach((user) => {
                mockFirebaseService.getAuth().getUserByEmail.mockResolvedValueOnce({
                    uid: user.firebaseUid,
                    email: user.email,
                    providerData: [{ providerId: 'password' }],
                });
            });

            // Check onboarding status for all users concurrently
            const results = await Promise.all(
                users.map((user) => authService.getOnboardingStatus({ email: user.email })),
            );

            // All should need onboarding (not in database)
            results.forEach((result) => {
                expect(result.needsOnboarding).toBe(true);
            });
        });

        it('should maintain data consistency across operations', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Mock Firebase response
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }],
            });

            // Create user
            await databaseService.user.create({
                data: {
                    firebaseUid,
                    email,
                    firstName: 'Consistency',
                    lastName: 'Test',
                    address: 'Test Address',
                },
            });

            // Verify user exists
            const dbUser = await databaseService.user.findUnique({
                where: { firebaseUid },
            });
            expect(dbUser).not.toBeNull();
            expect(dbUser?.email).toBe(email);

            // Verify onboarding status reflects database state
            const status = await authService.getOnboardingStatus({ email });
            expect(status.needsOnboarding).toBe(false);
        });
    });
});
