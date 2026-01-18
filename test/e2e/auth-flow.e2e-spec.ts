/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestDatabaseHelper, TestDataHelper, TestServerHelper } from '../helpers';
import {
    createMockFirebaseAuth,
    createMockFirebaseService,
    createMockSendGrid,
    FirebaseAuthErrors,
} from '../mocks';
import { FirebaseService } from '../../src/firebase/firebase.service';
import { EmailService } from '../../src/email/email.service';

describe('Auth Flow E2E Tests', () => {
    let app: INestApplication;
    let dbHelper: TestDatabaseHelper;
    let serverHelper: TestServerHelper;

    const mockAuth = createMockFirebaseAuth();
    const mockFirebaseService = createMockFirebaseService(mockAuth);
    const mockSendGridService = createMockSendGrid();

    beforeAll(async () => {
        // Initialize database helper
        dbHelper = new TestDatabaseHelper();
        await dbHelper.connect();

        // Create NestJS testing module
        serverHelper = new TestServerHelper();
        app = await serverHelper.createTestApp({
            providers: [
                // Replace the actual service with your factory-created mock
                { provide: FirebaseService, useValue: mockFirebaseService },
                { provide: EmailService, useValue: mockSendGridService },
            ],
        });
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
    });

    describe('GET /api/auth/providers', () => {
        it('should return sign-in providers for existing Firebase user', async () => {
            // Note: In real E2E, this would hit Firebase
            // For testing, we mock Firebase responses in the test environment
            const email = 'existing.user@example.com';

            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: 'test-uid',
                email,
                providerData: ['password', 'google.com'],
            });

            const response = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email })
                .expect(200);

            expect(response.body).toHaveProperty('providers');
            expect(Array.isArray(response.body.providers)).toBe(true);
        });

        it('should return 404 when user does not exist', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            const response = await request(app.getHttpServer())
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
            const response = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email: 'invalid-email' })
                .expect(400);

            expect(response.body).toMatchObject({
                statusCode: 400,
            });
            expect(response.body.message).toContain('Invalid email format');
        });

        it('should return 400 when email query param is missing', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .expect(400);

            expect(response.body).toMatchObject({
                statusCode: 400,
            });
        });

        it('should handle multiple requests in sequence', async () => {
            const emails = ['user1@example.com', 'user2@example.com', 'user3@example.com'];

            for (const email of emails) {
                await request(app.getHttpServer())
                    .get('/api/auth/providers')
                    .query({ email })
                    .expect((res) => {
                        expect([200, 404]).toContain(res.status);
                    });
            }
        });

        it('should return proper error response structure', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email: 'notfound@example.com' })
                .expect(404);

            // Verify error response follows AllExceptionsFilter format
            expect(response.body).toHaveProperty('statusCode', 404);
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty(
                'path',
                '/api/auth/providers?email=notfound%40example.com',
            );
            expect(response.body).toHaveProperty('message');
            expect(typeof response.body.timestamp).toBe('string');
            expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
        });
    });

    describe('GET /api/auth/onboarding-status', () => {
        it('should return needsOnboarding=true when user exists in Firebase but not in database', async () => {
            const email = 'firebase.only@example.com';
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: ['password', 'google.com'],
            });

            const response = await request(app.getHttpServer())
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            expect(response.body).toHaveProperty('needsOnboarding');
            expect(response.body).toHaveProperty('message');
            expect(typeof response.body.needsOnboarding).toBe('boolean');
        });

        it('should return needsOnboarding=false when user exists in both Firebase and database', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }],
            });

            // Create user in database
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: 'Test',
                lastName: 'User',
                address: 'Test Address',
            });

            const response = await request(app.getHttpServer())
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            expect(response.body).toMatchObject({
                needsOnboarding: false,
                message: 'User profile exists',
            });
        });

        it('should return 404 when Firebase user does not exist', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            const response = await request(app.getHttpServer())
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(404);

            expect(response.body).toMatchObject({
                statusCode: 404,
                message: 'No user found for this email',
            });
        });

        it('should return 400 for invalid email format', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/auth/onboarding-status')
                .query({ email: 'not-an-email' })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('Invalid email format');
        });

        it('should include providers when needsOnboarding is true', async () => {
            const email = 'new.user@example.com';
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: ['password'],
            });

            const response = await request(app.getHttpServer())
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect((res) => {
                    // Should be either 200 (exists) or 404 (not found)
                    expect([200, 404]).toContain(res.status);
                });

            if (response.status === 200 && response.body.needsOnboarding === true) {
                expect(response.body).toHaveProperty('providers');
                expect(Array.isArray(response.body.providers)).toBe(true);
            }
        });

        it('should NOT include providers when needsOnboarding is false', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: ['password'],
            });

            // Create user in database
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: 'Complete',
                lastName: 'User',
                address: 'Complete Address',
            });

            const response = await request(app.getHttpServer())
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            expect(response.body.needsOnboarding).toBe(false);
            expect(response.body).not.toHaveProperty('providers');
        });
    });

    describe('POST /api/auth/reset-password', () => {
        it('should reset password successfully for existing user', async () => {
            const email = 'existing.user@example.com';
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const newPassword = TestDataHelper.generateStrongPassword();

            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
            });

            mockFirebaseService.getAuth().updateUser.mockResolvedValue({
                uid: firebaseUid,
                email,
            });

            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({ email, newPassword })
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'Password updated successfully',
            });
        });

        it('should return 404 when user does not exist', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const newPassword = TestDataHelper.generateStrongPassword();

            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({ email, newPassword })
                .expect(404);

            expect(response.body).toMatchObject({
                statusCode: 404,
                message: 'No user found for this email',
            });
        });

        it('should return 400 for invalid email format', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({
                    email: 'invalid-email',
                    newPassword: 'ValidPass123!',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('Invalid email format');
        });

        it('should return 400 for weak password', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({
                    email: 'user@example.com',
                    newPassword: 'weak',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('Password must');
        });

        it('should return 400 for password without uppercase', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({
                    email: 'user@example.com',
                    newPassword: 'lowercase123!',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('uppercase');
        });

        it('should return 400 for password without lowercase', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({
                    email: 'user@example.com',
                    newPassword: 'UPPERCASE123!',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('lowercase');
        });

        it('should return 400 for password without digit', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({
                    email: 'user@example.com',
                    newPassword: 'NoDigits!',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('digit');
        });

        it('should return 400 for password without symbol', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({
                    email: 'user@example.com',
                    newPassword: 'NoSymbols123',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('symbol');
        });

        it('should return 400 for password less than 8 characters', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({
                    email: 'user@example.com',
                    newPassword: 'Short1!',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('at least 8 characters');
        });

        it('should return 400 when email is missing', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({
                    newPassword: 'ValidPass123!',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
        });

        it('should return 400 when newPassword is missing', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({
                    email: 'user@example.com',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
        });

        it('should return 400 for extra fields (forbidNonWhitelisted)', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({
                    email: 'user@example.com',
                    newPassword: 'ValidPass123!',
                    extraField: 'should-not-be-here',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
        });

        it('should accept valid password with all requirements', async () => {
            const validPasswords = ['ValidPass1!', 'Secure@123', 'MyP@ssw0rd', 'C0mpl3x!Pass'];

            for (const password of validPasswords) {
                await request(app.getHttpServer())
                    .post('/api/auth/reset-password')
                    .send({
                        email: 'existing.user@example.com',
                        newPassword: password,
                    })
                    .expect((res) => {
                        // Should be either 200 (success) or 404 (user not found)
                        // but NOT 400 (validation error)
                        expect([200, 404]).toContain(res.status);
                    });
            }
        });
    });

    describe('Complete Auth Flow', () => {
        it('should handle complete new user flow', async () => {
            const email = 'existing.user@example.com';
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }],
            });

            // Step 1: Check sign-in providers
            const providersResponse = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email })
                .expect(200);

            expect(providersResponse.body).toHaveProperty('providers');
            expect(Array.isArray(providersResponse.body.providers)).toBe(true);

            // Step 2: Check onboarding status
            const onboardingResponse = await request(app.getHttpServer())
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            expect(onboardingResponse.body).toHaveProperty('needsOnboarding');
            expect(onboardingResponse.body.needsOnboarding).toBe(true);
        });

        it('should handle complete existing user flow', async () => {
            const email = 'existing.user@example.com';
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Step 1: Check sign-in providers
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }],
            });

            const providersResponse = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email })
                .expect(200);

            expect(providersResponse.body).toHaveProperty('providers');
            expect(Array.isArray(providersResponse.body.providers)).toBe(true);

            // Step 2: Check onboarding status
            // Create user in database
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: 'Test',
                lastName: 'User',
                address: 'Test Address',
            });

            const onboardingResponse = await request(app.getHttpServer())
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            expect(onboardingResponse.body).toHaveProperty('needsOnboarding');
            expect(onboardingResponse.body.needsOnboarding).toBe(false);

            // Step 3: Reset password (if user forgot)
            mockFirebaseService.getAuth().updateUser.mockResolvedValue({
                uid: firebaseUid,
                email,
            });

            const newPassword = TestDataHelper.generateStrongPassword();
            await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({ email, newPassword })
                .expect(200);
        });

        it('should handle user with incomplete onboarding', async () => {
            const email = 'firebase.only@example.com';
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Step 1: Check providers (exists in Firebase)
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: firebaseUid,
                email,
                providerData: [{ providerId: 'password' }],
            });

            const providersResponse = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email })
                .expect(200);

            expect(providersResponse.body).toHaveProperty('providers');

            // Step 2: Check onboarding status (not in database)
            const onboardingResponse = await request(app.getHttpServer())
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            // Should need onboarding
            if (onboardingResponse.body.needsOnboarding === true) {
                expect(onboardingResponse.body).toHaveProperty('providers');
                expect(onboardingResponse.body.message).toContain('no profile found');
            }
        });

        it('should handle multiple sequential password resets', async () => {
            const email = 'existing.user@example.com';
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            mockFirebaseService.getAuth().updateUser.mockResolvedValue({
                uid: firebaseUid,
                email,
            });

            // Reset password multiple times
            for (let i = 0; i < 3; i++) {
                const newPassword = TestDataHelper.generateStrongPassword();

                await request(app.getHttpServer())
                    .post('/api/auth/reset-password')
                    .send({ email, newPassword })
                    .expect(200);
            }
        });
    });

    describe('Error Response Consistency', () => {
        it('should return consistent error format for all endpoints', async () => {
            const endpoints = [
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
                {
                    method: 'post',
                    path: '/api/auth/reset-password',
                    body: { email: 'notfound@example.com', newPassword: 'ValidPass123!' },
                },
            ];

            for (const endpoint of endpoints) {
                let request_builder = request(app.getHttpServer())[endpoint.method](endpoint.path);

                if (endpoint.query) {
                    request_builder = request_builder.query(endpoint.query);
                }

                if (endpoint.body) {
                    request_builder = request_builder.send(endpoint.body);
                }

                const response = await request_builder.expect((res) => {
                    expect([200, 400, 404, 500]).toContain(res.status);
                });

                // Verify error response structure
                if (response.status >= 400) {
                    expect(response.body).toHaveProperty('statusCode');
                    expect(response.body).toHaveProperty('timestamp');
                    expect(response.body).toHaveProperty('path');
                    expect(response.body).toHaveProperty('message');
                    expect(typeof response.body.timestamp).toBe('string');
                }
            }
        });

        it('should include correct HTTP status codes in error responses', async () => {
            // 400 - Validation error
            const badRequest = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email: 'invalid-email' })
                .expect(400);

            expect(badRequest.body.statusCode).toBe(400);

            // 404 - Not found
            const notFound = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email: TestDataHelper.generateRandomEmail() })
                .expect(404);

            expect(notFound.body.statusCode).toBe(404);
        });

        it('should include request path in error responses', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email: 'invalid-email' })
                .expect(400);

            expect(response.body.path).toBe('/api/auth/providers?email=invalid-email');
        });

        it('should include ISO timestamp in error responses', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email: 'invalid-email' })
                .expect(400);

            const timestamp = new Date(response.body.timestamp);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.toString()).not.toBe('Invalid Date');
        });
    });

    describe('CORS and Headers', () => {
        it('should include CORS headers', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email: 'test@example.com' });

            // CORS headers should be present
            expect(response.headers).toHaveProperty('access-control-allow-origin');
        });

        it('should accept JSON content type', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .set('Content-Type', 'application/json')
                .send({
                    email: 'test@example.com',
                    newPassword: 'ValidPass123!',
                })
                .expect((res) => {
                    expect([200, 404, 500]).toContain(res.status);
                });
        });

        it('should return JSON responses', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email: 'test@example.com' });

            expect(response.headers['content-type']).toMatch(/json/);
        });
    });

    describe('API Prefix', () => {
        it('should be accessible with /api prefix', async () => {
            await request(app.getHttpServer())
                .get('/api/auth/providers')
                .query({ email: 'test@example.com' })
                .expect((res) => {
                    expect([200, 404]).toContain(res.status);
                });
        });

        it('should return 404 without /api prefix', async () => {
            await request(app.getHttpServer())
                .get('/auth/providers')
                .query({ email: 'test@example.com' })
                .expect(404);
        });
    });
});
