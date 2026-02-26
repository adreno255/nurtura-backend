import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestDatabaseHelper, TestDataHelper, TestServerHelper } from '../helpers';
import {
    createMockDecodedToken,
    createMockEmailService,
    createMockFirebaseAuth,
    createMockFirebaseService,
    FirebaseAuthErrors,
} from '../mocks';
import { FirebaseService } from '../../src/firebase/firebase.service';
import { EmailService } from '../../src/email/email.service';
import { type ExceptionResponse } from '../../src/common/interfaces';
import { type Server } from 'http';

describe('Auth Integration Tests', () => {
    let app: INestApplication;
    let dbHelper: TestDatabaseHelper;
    let serverHelper: TestServerHelper;
    let httpServer: Server;
    let mockFirebaseJWT: ReturnType<typeof createMockDecodedToken>;

    const mockAuth = createMockFirebaseAuth();
    const mockFirebaseService = createMockFirebaseService(mockAuth);
    const mockEmailService = createMockEmailService();

    // valid JWT token string for authenticated requests
    const validAuthToken = 'valid-firebase-jwt-token';

    beforeAll(async () => {
        // Initialize database helper
        dbHelper = new TestDatabaseHelper();
        await dbHelper.connect();

        // Create NestJS testing module with mocked external services
        serverHelper = new TestServerHelper();
        app = await serverHelper.createTestApp({
            providers: [
                { provide: FirebaseService, useValue: mockFirebaseService },
                { provide: EmailService, useValue: mockEmailService },
            ],
        });
        httpServer = app.getHttpServer() as Server;
    });

    afterAll(async () => {
        await dbHelper.clearDatabase();
        await dbHelper.disconnect();
        await serverHelper.closeApp();
    });

    beforeEach(async () => {
        // Clean database before each test
        await dbHelper.clearDatabase();
        jest.clearAllMocks();

        // reset mock decoded token
        mockFirebaseJWT = createMockDecodedToken();
    });

    describe('GET /api/auth/providers', () => {
        it('should return sign-in providers for existing Firebase user', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockAuth.getUserByEmail.mockResolvedValueOnce({
                uid: 'test-uid',
                email,
                providerData: [{ providerId: 'password' }, { providerId: 'google.com' }],
            } as any);

            const response = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email })
                .expect(200);

            expect(response.body).toEqual({
                providers: ['password', 'google.com'],
            });
            expect(mockAuth.getUserByEmail).toHaveBeenCalledWith(email);
        });

        it('should return empty providers array for user with no providers', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockAuth.getUserByEmail.mockResolvedValueOnce({
                uid: 'test-uid',
                email,
                providerData: [],
            } as any);

            const response = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email })
                .expect(200);

            expect(response.body).toEqual({
                providers: [],
            });
        });

        it('should return single provider for password-only user', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockAuth.getUserByEmail.mockResolvedValueOnce({
                uid: 'test-uid',
                email,
                providerData: [{ providerId: 'password' }],
            } as any);

            const response = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email })
                .expect(200);

            expect(response.body).toEqual({
                providers: ['password'],
            });
        });

        it('should throw 404 when Firebase user does not exist', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockAuth.getUserByEmail.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());

            const response = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email })
                .expect(404);

            expect(response.body).toMatchObject({
                statusCode: 404,
                message: 'No user found for this email',
            });
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('path');
        });

        it('should return 400 for invalid email format', async () => {
            const response = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email: 'invalid-email' })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('Invalid email format');
        });

        it('should return 400 when email query param is missing', async () => {
            const response = await request(httpServer).get('/api/auth/providers').expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
        });

        it('should handle multiple providers correctly', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockAuth.getUserByEmail.mockResolvedValueOnce({
                uid: 'test-uid',
                email,
                providerData: [{ providerId: 'password' }, { providerId: 'google.com' }],
            } as any);

            const response = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email })
                .expect(200);

            expect(response.body).toEqual({
                providers: ['password', 'google.com'],
            });
        });

        it('should return proper error response structure', async () => {
            const email = 'notfound@example.com';

            mockAuth.getUserByEmail.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());

            const response = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email })
                .expect(404);

            const body = response.body as ExceptionResponse;

            expect(body).toHaveProperty('statusCode', 404);
            expect(body).toHaveProperty('timestamp');
            expect(body).toHaveProperty('path');
            expect(body).toHaveProperty('message');
            expect(typeof body.timestamp).toBe('string');
            expect(new Date(body.timestamp)).toBeInstanceOf(Date);
        });
    });

    describe('GET /api/auth/onboarding-status', () => {
        it('should return needsOnboarding=true when user exists in Firebase but not in database', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            mockAuth.getUserByEmail.mockResolvedValueOnce({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }],
            } as any);

            const response = await request(httpServer)
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            expect(response.body).toMatchObject({
                needsOnboarding: true,
                providers: ['password'],
                message: 'User exists in Firebase, but no profile found in database',
            });
        });

        it('should return needsOnboarding=false when user exists in both Firebase and database', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            mockAuth.getUserByEmail.mockResolvedValueOnce({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }],
            } as any);

            // Create user in real database
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: 'Test',
                lastName: 'User',
                address: 'Test Address',
            });

            const response = await request(httpServer)
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            expect(response.body).toMatchObject({
                needsOnboarding: false,
                message: 'User profile exists',
            });
            expect(response.body).not.toHaveProperty('providers');
        });

        it('should throw 400 when Firebase user has no sign-in methods', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            mockAuth.getUserByEmail.mockResolvedValueOnce({
                uid: firebaseUid,
                email,
                providerData: [],
            } as any);

            const response = await request(httpServer)
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(400);

            expect(response.body).toMatchObject({
                statusCode: 400,
                message: 'No sign-in methods found for this user',
            });
        });

        it('should throw 404 when Firebase user does not exist', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockAuth.getUserByEmail.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());

            const response = await request(httpServer)
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(404);

            expect(response.body).toMatchObject({
                statusCode: 404,
                message: 'No user found for this email',
            });
        });

        it('should return 400 for invalid email format', async () => {
            const response = await request(httpServer)
                .get('/api/auth/onboarding-status')
                .query({ email: 'not-an-email' })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('Invalid email format');
        });

        it('should include providers array when needsOnboarding is true', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            mockAuth.getUserByEmail.mockResolvedValueOnce({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }, { providerId: 'google.com' }],
            } as any);

            const response = await request(httpServer)
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            expect(response.body).toEqual({
                needsOnboarding: true,
                providers: ['password', 'google.com'],
                message: 'User exists in Firebase, but no profile found in database',
            });
        });

        it('should handle database integration correctly', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            mockAuth.getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }],
            } as any);

            // First check - user not in database
            const response1 = await request(httpServer)
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            expect(response1.body).toMatchObject({
                needsOnboarding: true,
            });

            // Create user in database
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: 'Test',
                lastName: 'User',
                address: 'Test Address',
            });

            // Second check - user now in database
            const response2 = await request(httpServer)
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            expect(response2.body).toMatchObject({
                needsOnboarding: false,
            });
        });
    });

    // NOTE: The endpoint is POST /api/auth/update-password (not /reset-password).
    // It requires a valid Bearer token (protected by the Firebase JWT auth guard).
    describe('POST /api/auth/update-password', () => {
        it('should update password successfully for existing Firebase user', async () => {
            const newPassword = TestDataHelper.generateStrongPassword();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);
            mockAuth.updateUser.mockResolvedValueOnce({
                uid: mockFirebaseJWT.uid,
                email: mockFirebaseJWT.email,
            } as any);

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({ newPassword })
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'Password updated successfully',
            });
            expect(mockAuth.updateUser).toHaveBeenCalledWith(mockFirebaseJWT.uid, {
                password: newPassword,
            });
        });

        it('should return 401 when not authenticated', async () => {
            const newPassword = TestDataHelper.generateStrongPassword();

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .send({ newPassword })
                .expect(401);

            const body = response.body as ExceptionResponse;
            expect(body.statusCode).toBe(401);
        });

        it('should throw 404 when Firebase user does not exist', async () => {
            const newPassword = TestDataHelper.generateStrongPassword();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);
            mockAuth.updateUser.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({ newPassword })
                .expect(404);

            expect(response.body).toMatchObject({
                statusCode: 404,
                message: 'No user found for this email',
            });
        });

        it('should return 400 for weak password', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    newPassword: 'weak',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('Password must');
        });

        it('should return 400 for password without uppercase', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    newPassword: 'lowercase123!',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('uppercase');
        });

        it('should return 400 for password without lowercase', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    newPassword: 'UPPERCASE123!',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('lowercase');
        });

        it('should return 400 for password without digit', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    newPassword: 'NoDigits!',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('digit');
        });

        it('should return 400 for password without symbol', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    newPassword: 'NoSymbols123',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('symbol');
        });

        it('should return 400 for password less than 8 characters', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    newPassword: 'Short1!',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('at least 8 characters');
        });

        it('should return 400 when newPassword is missing', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    email: 'user@example.com',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
        });

        it('should return 400 for extra fields (forbidNonWhitelisted)', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    newPassword: 'ValidPass123!',
                    extraField: 'should-not-be-here',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
        });

        it('should accept valid password with all requirements', async () => {
            const validPasswords = ['ValidPass1!', 'Secure@123', 'MyP@ssw0rd', 'C0mpl3x!Pass'];

            for (const password of validPasswords) {
                mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);
                mockAuth.updateUser.mockResolvedValueOnce({
                    uid: mockFirebaseJWT.uid,
                    email: mockFirebaseJWT.email,
                } as any);

                await request(httpServer)
                    .post('/api/auth/update-password')
                    .set('Authorization', `Bearer ${validAuthToken}`)
                    .send({
                        newPassword: password,
                    })
                    .expect(200);
            }
        });

        it('should handle multiple password updates for same user', async () => {
            mockAuth.updateUser.mockResolvedValue({
                uid: mockFirebaseJWT.uid,
                email: mockFirebaseJWT.email,
            } as any);

            // Update password multiple times
            for (let i = 0; i < 3; i++) {
                const newPassword = TestDataHelper.generateStrongPassword();
                mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

                await request(httpServer)
                    .post('/api/auth/update-password')
                    .set('Authorization', `Bearer ${validAuthToken}`)
                    .send({ newPassword })
                    .expect(200);
            }

            expect(mockAuth.updateUser).toHaveBeenCalledTimes(3);
        });

        it('should handle Firebase updateUser failures', async () => {
            const newPassword = TestDataHelper.generateStrongPassword();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);
            mockAuth.updateUser.mockRejectedValueOnce(new Error('Firebase update failed'));

            const response = await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({ newPassword })
                .expect(500);

            const body = response.body as ExceptionResponse;

            // The service throws InternalServerErrorException('Failed to reset password')
            expect(body.message).toContain('Failed to reset password');
        });
    });

    describe('POST /api/auth/otp/registration', () => {
        it('should send registration OTP successfully', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendRegistrationOtp.mockResolvedValueOnce([
                { statusCode: 200 },
                {},
            ] as any);

            const response = await request(httpServer)
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'Registration OTP sent successfully. Please check your email.',
            });
            expect(mockEmailService.sendRegistrationOtp).toHaveBeenCalled();
        });

        it('should return 400 for invalid email format', async () => {
            const response = await request(httpServer)
                .post('/api/auth/otp/registration')
                .send({ email: 'not-an-email' })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('Invalid email format');
        });

        it('should return 400 when email is missing', async () => {
            const response = await request(httpServer)
                .post('/api/auth/otp/registration')
                .send({})
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
        });

        it('should return 400 for extra fields', async () => {
            const response = await request(httpServer)
                .post('/api/auth/otp/registration')
                .send({
                    email: 'test@example.com',
                    extraField: 'should-not-be-here',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
        });

        it('should allow sending OTP to multiple different emails', async () => {
            const emails = Array.from({ length: 3 }, () => TestDataHelper.generateRandomEmail());

            mockEmailService.sendRegistrationOtp.mockResolvedValue([
                { statusCode: 202 },
                {},
            ] as any);

            for (const email of emails) {
                await request(httpServer)
                    .post('/api/auth/otp/registration')
                    .send({ email })
                    .expect(200);
            }

            expect(mockEmailService.sendRegistrationOtp).toHaveBeenCalledTimes(3);
        });

        it('should allow resending OTP to same email', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendRegistrationOtp.mockResolvedValue([
                { statusCode: 202 },
                {},
            ] as any);

            // Send first OTP
            await request(httpServer)
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            // Resend OTP
            await request(httpServer)
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            expect(mockEmailService.sendRegistrationOtp).toHaveBeenCalledTimes(2);
        });

        it('should handle SendGrid failures', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendRegistrationOtp.mockRejectedValueOnce(new Error('SendGrid error'));

            const response = await request(httpServer)
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(500);

            const body = response.body as ExceptionResponse;

            expect(body.message).toContain('Failed to send registration OTP email');
        });

        it('should handle various valid email formats', async () => {
            const validEmails = [
                'user@example.com',
                'user.name@example.com',
                'user+tag@example.co.uk',
                'user_name@sub.example.com',
            ];

            mockEmailService.sendRegistrationOtp.mockResolvedValue([
                { statusCode: 202 },
                {},
            ] as any);

            for (const email of validEmails) {
                await request(httpServer)
                    .post('/api/auth/otp/registration')
                    .send({ email })
                    .expect(200);
            }
        });
    });

    describe('POST /api/auth/otp/forgot-password', () => {
        it('should send forgot password OTP successfully', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendForgotPasswordOtp.mockResolvedValueOnce([
                { statusCode: 200 },
                {},
            ] as any);

            const response = await request(httpServer)
                .post('/api/auth/otp/forgot-password')
                .send({ email })
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'Forgot password OTP sent successfully. Please check your email.',
            });
            expect(mockEmailService.sendForgotPasswordOtp).toHaveBeenCalled();
        });

        it('should return 400 for invalid email format', async () => {
            const response = await request(httpServer)
                .post('/api/auth/otp/forgot-password')
                .send({ email: 'not-an-email' })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('Invalid email format');
        });

        it('should return 400 when email is missing', async () => {
            const response = await request(httpServer)
                .post('/api/auth/otp/forgot-password')
                .send({})
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
        });

        it('should allow resending OTP to same email', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendForgotPasswordOtp.mockResolvedValue([
                { statusCode: 202 },
                {},
            ] as any);

            await request(httpServer)
                .post('/api/auth/otp/forgot-password')
                .send({ email })
                .expect(200);

            await request(httpServer)
                .post('/api/auth/otp/forgot-password')
                .send({ email })
                .expect(200);

            expect(mockEmailService.sendForgotPasswordOtp).toHaveBeenCalledTimes(2);
        });

        it('should handle SendGrid failures', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendForgotPasswordOtp.mockRejectedValueOnce(
                new Error('SendGrid error'),
            );

            const response = await request(httpServer)
                .post('/api/auth/otp/forgot-password')
                .send({ email })
                .expect(500);

            const body = response.body as ExceptionResponse;

            expect(body.message).toContain('Failed to send forgot password OTP email');
        });
    });

    // NOTE: POST /api/auth/otp/password-reset requires a Bearer token (no @Public decorator).
    describe('POST /api/auth/otp/password-reset', () => {
        it('should send password reset OTP successfully when authenticated', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendPasswordResetOtp.mockResolvedValueOnce([
                { statusCode: 202 },
                {},
            ] as any);
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/otp/password-reset')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({ email })
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'Password reset OTP sent successfully. Please check your email.',
            });
            expect(mockEmailService.sendPasswordResetOtp).toHaveBeenCalled();
        });

        it('should return 401 when not authenticated', async () => {
            const email = TestDataHelper.generateRandomEmail();

            const response = await request(httpServer)
                .post('/api/auth/otp/password-reset')
                .send({ email })
                .expect(401);

            const body = response.body as ExceptionResponse;
            expect(body.statusCode).toBe(401);
        });

        it('should return 400 for invalid email format', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/otp/password-reset')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({ email: 'invalid-email' })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('Invalid email format');
        });

        it('should return 400 when email is missing', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/otp/password-reset')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({})
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
        });

        it('should handle multiple password reset requests', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendPasswordResetOtp.mockResolvedValue([
                { statusCode: 202 },
                {},
            ] as any);

            for (let i = 0; i < 3; i++) {
                mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

                await request(httpServer)
                    .post('/api/auth/otp/password-reset')
                    .set('Authorization', `Bearer ${validAuthToken}`)
                    .send({ email })
                    .expect(200);
            }

            expect(mockEmailService.sendPasswordResetOtp).toHaveBeenCalledTimes(3);
        });

        it('should handle SendGrid failures', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendPasswordResetOtp.mockRejectedValueOnce(
                new Error('SendGrid error'),
            );
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/otp/password-reset')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({ email })
                .expect(500);

            const body = response.body as ExceptionResponse;

            expect(body.message).toContain('Failed to send password reset OTP email');
        });
    });

    // NOTE: POST /api/auth/otp/email-reset requires a Bearer token (no @Public decorator).
    describe('POST /api/auth/otp/email-reset', () => {
        it('should send email reset OTP when authenticated', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendEmailResetOtp.mockResolvedValueOnce([
                { statusCode: 200 },
                {},
            ] as any);
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/otp/email-reset')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({ email })
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'Email reset OTP sent successfully. Please check your email.',
            });
            expect(mockEmailService.sendEmailResetOtp).toHaveBeenCalledWith(
                email,
                expect.any(String),
                expect.any(String),
            );
        });

        it('should return 401 when not authenticated', async () => {
            const email = TestDataHelper.generateRandomEmail();

            const response = await request(httpServer)
                .post('/api/auth/otp/email-reset')
                .send({ email })
                .expect(401);

            const body = response.body as ExceptionResponse;
            expect(body.statusCode).toBe(401);
        });

        it('should return 400 for invalid email format', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/otp/email-reset')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({ email: 'not-an-email' })
                .expect(400);

            const body = response.body as ExceptionResponse;
            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('Invalid email format');
        });

        it('should handle SendGrid failures', async () => {
            const email = TestDataHelper.generateRandomEmail();
            mockEmailService.sendEmailResetOtp.mockRejectedValueOnce(new Error('SendGrid error'));
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/auth/otp/email-reset')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({ email })
                .expect(500);

            const body = response.body as ExceptionResponse;
            expect(body.message).toContain('Failed to send email reset OTP email');
        });
    });

    describe('POST /api/auth/otp/verify', () => {
        it('should return 400 for invalid OTP code format', async () => {
            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    code: '123', // Too short
                    purpose: 'registration',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('5 digits');
        });

        it('should return 400 for invalid purpose', async () => {
            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    code: '12345',
                    purpose: 'invalid-purpose',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
        });

        it('should return 400 when email is missing', async () => {
            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({
                    code: '12345',
                    purpose: 'registration',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
        });

        it('should return 400 when code is missing', async () => {
            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    purpose: 'registration',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
        });

        it('should return 400 when purpose is missing', async () => {
            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    code: '12345',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
        });

        it('should return 400 for non-existent OTP', async () => {
            const email = TestDataHelper.generateRandomEmail();

            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({
                    email,
                    code: '12345',
                    purpose: 'registration',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.message).toContain('No OTP found');
        });

        it('should validate OTP code is exactly 5 digits', async () => {
            const invalidCodes = ['1234', '123456', 'abcde', '12.45', '12 45'];

            for (const code of invalidCodes) {
                await request(httpServer)
                    .post('/api/auth/otp/verify')
                    .send({
                        email: 'test@example.com',
                        code,
                        purpose: 'registration',
                    })
                    .expect(400);
            }
        });

        it('should reject OTP code with letters', async () => {
            await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    code: 'ABCDE',
                    purpose: 'registration',
                })
                .expect(400);
        });

        it('should reject OTP code with special characters', async () => {
            await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    code: '12!45',
                    purpose: 'registration',
                })
                .expect(400);
        });

        it('should return 400 when purpose does not match stored OTP purpose', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendRegistrationOtp.mockResolvedValueOnce([
                { statusCode: 200 },
                {},
            ] as never);

            await request(httpServer)
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            const [[, code]] = mockEmailService.sendRegistrationOtp.mock.calls as [
                string,
                string,
            ][];

            // Attempt to verify with wrong purpose
            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({ email, code, purpose: 'forgot-password' })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(400);
            expect(body.message).toContain('Invalid OTP context');
        });

        // Success paths
        it('should verify OTP successfully for registration flow', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendRegistrationOtp.mockResolvedValueOnce([
                { statusCode: 200 },
                {},
            ] as never);

            await request(httpServer)
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            const [[, code]] = mockEmailService.sendRegistrationOtp.mock.calls as [
                string,
                string,
            ][];

            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({ email, code, purpose: 'registration' })
                .expect(200);

            expect(response.body).toEqual({ message: 'OTP verified successfully.' });
        });

        it('should verify OTP successfully for password-reset flow', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendPasswordResetOtp.mockResolvedValueOnce([
                { statusCode: 200 },
                {},
            ] as never);
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/auth/otp/password-reset')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({ email })
                .expect(200);

            const [[, code]] = mockEmailService.sendPasswordResetOtp.mock.calls as [
                string,
                string,
            ][];

            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({ email, code, purpose: 'password-reset' })
                .expect(200);

            expect(response.body).toEqual({ message: 'OTP verified successfully.' });
        });

        it('should verify OTP successfully for email-reset flow', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendEmailResetOtp.mockResolvedValueOnce([
                { statusCode: 200 },
                {},
            ] as never);
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/auth/otp/email-reset')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({ email })
                .expect(200);

            const [[, code]] = mockEmailService.sendEmailResetOtp.mock.calls as [string, string][];

            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({ email, code, purpose: 'email-reset' })
                .expect(200);

            expect(response.body).toEqual({ message: 'OTP verified successfully.' });
        });

        it('should verify OTP successfully for forgot-password flow and return a loginToken', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Seed user in database (required by forgot-password verify path)
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: 'Test',
                lastName: 'User',
                address: 'Test Address',
            });

            mockEmailService.sendForgotPasswordOtp.mockResolvedValueOnce([
                { statusCode: 200 },
                {},
            ] as never);

            await request(httpServer)
                .post('/api/auth/otp/forgot-password')
                .send({ email })
                .expect(200);

            const [[, code]] = mockEmailService.sendForgotPasswordOtp.mock.calls as [
                string,
                string,
            ][];

            mockAuth.createCustomToken.mockResolvedValueOnce('mock-custom-token');

            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({ email, code, purpose: 'forgot-password' })
                .expect(200);

            expect(response.body).toEqual({
                message: 'OTP verified successfully.',
                loginToken: 'mock-custom-token',
            });
            expect(mockAuth.createCustomToken).toHaveBeenCalledWith(firebaseUid);
        });

        it('should return 404 when user not found in database during forgot-password verify', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendForgotPasswordOtp.mockResolvedValueOnce([
                { statusCode: 200 },
                {},
            ] as never);

            await request(httpServer)
                .post('/api/auth/otp/forgot-password')
                .send({ email })
                .expect(200);

            const [[, code]] = mockEmailService.sendForgotPasswordOtp.mock.calls as [
                string,
                string,
            ][];

            // No user seeded in DB — should throw 404
            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({ email, code, purpose: 'forgot-password' })
                .expect(404);

            const body = response.body as ExceptionResponse;

            expect(body.statusCode).toBe(404);
            expect(body.message).toContain('User not found');
        });

        it('should return 500 when createCustomToken fails during forgot-password verify', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: 'Test',
                lastName: 'User',
                address: 'Test Address',
            });

            mockEmailService.sendForgotPasswordOtp.mockResolvedValueOnce([
                { statusCode: 200 },
                {},
            ] as never);

            await request(httpServer)
                .post('/api/auth/otp/forgot-password')
                .send({ email })
                .expect(200);

            const [[, code]] = mockEmailService.sendForgotPasswordOtp.mock.calls as [
                string,
                string,
            ][];

            mockAuth.createCustomToken.mockRejectedValueOnce(
                new Error('Firebase token creation failed'),
            );

            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({ email, code, purpose: 'forgot-password' })
                .expect(500);

            const body = response.body as ExceptionResponse;

            expect(body.message).toContain('Failed to create login token');
        });

        it('should consume OTP after successful verification (cannot reuse)', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockEmailService.sendRegistrationOtp.mockResolvedValueOnce([
                { statusCode: 200 },
                {},
            ] as never);

            await request(httpServer)
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            const [[, code]] = mockEmailService.sendRegistrationOtp.mock.calls as [
                string,
                string,
            ][];

            // First verification - success
            await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({ email, code, purpose: 'registration' })
                .expect(200);

            // Second verification with the same code - should fail
            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({ email, code, purpose: 'registration' })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.message).toContain('No OTP found');
        });
    });

    describe('Error Response Consistency', () => {
        it('should return consistent error format for all endpoints', async () => {
            mockAuth.getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            const endpoints: Array<{
                method: 'get' | 'post';
                path: string;
                query?: Record<string, string>;
                body?: Record<string, string>;
                auth?: boolean;
            }> = [
                {
                    method: 'get',
                    path: '/api/auth/providers',
                    query: { email: 'notfound@example.com' },
                },
                {
                    method: 'get',
                    path: '/api/auth/onboarding-status',
                    query: { email: 'notfound@example.com' },
                },
            ];

            for (const endpoint of endpoints) {
                if (endpoint.auth) {
                    mockFirebaseService
                        .getAuth()
                        .verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);
                }

                let requestBuilder = request(httpServer)[endpoint.method](endpoint.path);

                if (endpoint.auth) {
                    requestBuilder = requestBuilder.set(
                        'Authorization',
                        `Bearer ${validAuthToken}`,
                    );
                }

                if (endpoint.query) {
                    requestBuilder = requestBuilder.query(endpoint.query);
                }

                if (endpoint.body) {
                    requestBuilder = requestBuilder.send(endpoint.body);
                }

                const response = await requestBuilder;
                const body = response.body as ExceptionResponse;

                if (response.status >= 400) {
                    expect(body).toHaveProperty('statusCode');
                    expect(body).toHaveProperty('timestamp');
                    expect(body).toHaveProperty('path');
                    expect(body).toHaveProperty('message');
                    expect(typeof body.timestamp).toBe('string');
                }
            }
        });

        it('should include correct HTTP status codes in error responses', async () => {
            // 400 - Validation error
            const badRequest = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email: 'invalid-email' })
                .expect(400);

            const badRequestBody = badRequest.body as ExceptionResponse;

            expect(badRequestBody.statusCode).toBe(400);

            // 404 - Not found
            mockAuth.getUserByEmail.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());

            const notFound = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email: TestDataHelper.generateRandomEmail() })
                .expect(404);

            const notFoundBody = notFound.body as ExceptionResponse;

            expect(notFoundBody.statusCode).toBe(404);
        });

        it('should include request path in error responses', async () => {
            const response = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email: 'invalid-email' })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.path).toContain('/api/auth/providers');
        });

        it('should include ISO timestamp in error responses', async () => {
            const response = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email: 'invalid-email' })
                .expect(400);

            const body = response.body as ExceptionResponse;

            const timestamp = new Date(body.timestamp);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.toString()).not.toBe('Invalid Date');
        });
    });

    describe('CORS and Headers', () => {
        it('should include CORS headers', async () => {
            mockAuth.getUserByEmail.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());

            const response = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email: 'test@example.com' });

            expect(response.headers).toHaveProperty('access-control-allow-origin');
        });

        it('should accept JSON content type', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);
            mockAuth.updateUser.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());

            await request(httpServer)
                .post('/api/auth/update-password')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .set('Content-Type', 'application/json')
                .send({
                    newPassword: 'ValidPass123!',
                })
                .expect(404);
        });

        it('should return JSON responses', async () => {
            mockAuth.getUserByEmail.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());

            const response = await request(httpServer)
                .get('/api/auth/providers')
                .query({ email: 'test@example.com' });

            expect(response.headers['content-type']).toMatch(/json/);
        });
    });

    describe('API Prefix', () => {
        it('should be accessible with /api prefix', async () => {
            mockAuth.getUserByEmail.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());

            await request(httpServer)
                .get('/api/auth/providers')
                .query({ email: 'test@example.com' })
                .expect(404);
        });

        it('should return 404 without /api prefix', async () => {
            await request(httpServer)
                .get('/auth/providers')
                .query({ email: 'test@example.com' })
                .expect(404);
        });
    });
});
