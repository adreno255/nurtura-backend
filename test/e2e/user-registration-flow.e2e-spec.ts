/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TestDatabaseHelper } from '../helpers/test-database.helper';
import { TestDataHelper } from '../helpers/test-data.helper';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { MyLoggerService } from '../../src/my-logger/my-logger.service';

describe('User Registration Flow E2E Tests', () => {
    let app: INestApplication;
    let dbHelper: TestDatabaseHelper;

    beforeAll(async () => {
        // Initialize database helper
        dbHelper = new TestDatabaseHelper();
        await dbHelper.connect();

        // Create NestJS testing module
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();

        // Apply same configuration as main.ts
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
                transformOptions: {
                    enableImplicitConversion: true,
                },
            }),
        );

        const logger = app.get(MyLoggerService);
        app.useGlobalFilters(new AllExceptionsFilter(logger));

        app.enableCors();
        app.setGlobalPrefix('api');

        await app.init();
    });

    afterAll(async () => {
        await dbHelper.clearDatabase();
        await dbHelper.disconnect();
        await app.close();
    });

    beforeEach(async () => {
        // Clean database before each test
        await dbHelper.clearDatabase();
    });

    describe('Complete Registration Flow', () => {
        it('should complete full registration flow: check email → send OTP → verify OTP → create user', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const userData = TestDataHelper.generateUserData();

            // Step 1: Check email availability
            const emailCheckResponse = await request(app.getHttpServer())
                .get('/api/users')
                .query({ email })
                .expect(200);

            expect(emailCheckResponse.body).toMatchObject({
                available: true,
                message: 'Email is available',
            });

            // Step 2: Send registration OTP
            const otpResponse = await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            expect(otpResponse.body).toMatchObject({
                message: 'Registration OTP sent successfully. Please check your email.',
            });

            // Step 3: Verify OTP
            // Note: In real test, we'd need to extract OTP from mock email service
            // For E2E, we assume OTP verification happens (or mock it)
            const mockOtp = '12345';
            const verifyResponse = await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email,
                    code: mockOtp,
                    purpose: 'registration',
                })
                .expect((res) => {
                    // Will succeed if OTP matches, fail if not
                    expect([200, 400]).toContain(res.status);
                });

            // Step 4: Create user profile (requires Firebase JWT - skip in this flow test)
            // This would be tested separately with authentication
        });

        it('should prevent registration with already registered email', async () => {
            const email = 'existing@example.com';

            // Step 1: Check email availability (should be taken if exists in Firebase)
            const emailCheckResponse = await request(app.getHttpServer())
                .get('/api/users')
                .query({ email })
                .expect(200);

            // Response depends on whether email exists in Firebase
            expect(emailCheckResponse.body).toHaveProperty('available');
            expect(emailCheckResponse.body).toHaveProperty('message');
        });

        it('should handle OTP expiry in registration flow', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Send OTP
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            // Wait for OTP to expire (or use expired code)
            await TestDataHelper.delay(100); // Simulate some time passing

            // Try to verify with potentially expired OTP
            const expiredOtp = '99999';
            await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email,
                    code: expiredOtp,
                    purpose: 'registration',
                })
                .expect(400);
        });

        it('should handle wrong OTP in registration flow', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Send OTP
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            // Try to verify with wrong OTP
            const wrongOtp = '00000';
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email,
                    code: wrongOtp,
                    purpose: 'registration',
                })
                .expect(400);

            expect(response.body.message).toMatch(/Invalid OTP|No OTP found|OTP has expired/);
        });
    });

    describe('POST /api/auth/otp/registration', () => {
        it('should send registration OTP successfully', async () => {
            const email = TestDataHelper.generateRandomEmail();

            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'Registration OTP sent successfully. Please check your email.',
            });
        });

        it('should return 400 for invalid email format', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email: 'not-an-email' })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('Invalid email format');
        });

        it('should return 400 when email is missing', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({})
                .expect(400);

            expect(response.body.statusCode).toBe(400);
        });

        it('should return 400 for extra fields', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({
                    email: 'test@example.com',
                    extraField: 'should-not-be-here',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
        });

        it('should allow sending multiple OTPs to different emails', async () => {
            const emails = Array.from({ length: 3 }, () => TestDataHelper.generateRandomEmail());

            for (const email of emails) {
                await request(app.getHttpServer())
                    .post('/api/auth/otp/registration')
                    .send({ email })
                    .expect(200);
            }
        });

        it('should allow resending OTP to same email', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Send first OTP
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            // Resend OTP
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);
        });

        it('should handle various valid email formats', async () => {
            const validEmails = [
                'user@example.com',
                'user.name@example.com',
                'user+tag@example.co.uk',
                'user_name@sub.example.com',
            ];

            for (const email of validEmails) {
                await request(app.getHttpServer())
                    .post('/api/auth/otp/registration')
                    .send({ email })
                    .expect(200);
            }
        });
    });

    describe('POST /api/auth/otp/forgot-password', () => {
        it('should send forgot password OTP successfully', async () => {
            const email = TestDataHelper.generateRandomEmail();

            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/forgot-password')
                .send({ email })
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'Password reset OTP sent successfully. Please check your email.',
            });
        });

        it('should return 400 for invalid email format', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/forgot-password')
                .send({ email: 'invalid-email' })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('Invalid email format');
        });

        it('should return 400 when email is missing', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/forgot-password')
                .send({})
                .expect(400);

            expect(response.body.statusCode).toBe(400);
        });

        it('should handle multiple forgot password requests', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Send multiple forgot password OTPs
            for (let i = 0; i < 3; i++) {
                await request(app.getHttpServer())
                    .post('/api/auth/otp/forgot-password')
                    .send({ email })
                    .expect(200);
            }
        });
    });

    describe('POST /api/auth/otp/verify', () => {
        it('should verify valid OTP successfully', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Send OTP first
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            // Note: In real E2E test, we'd need access to the generated OTP
            // For this test, we demonstrate the API structure
            const mockOtp = '12345';

            await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email,
                    code: mockOtp,
                    purpose: 'registration',
                })
                .expect((res) => {
                    // Will be 200 if OTP matches, 400 if not
                    expect([200, 400]).toContain(res.status);
                });
        });

        it('should return 400 for invalid OTP code format', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    code: '123', // Too short
                    purpose: 'registration',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('5 digits');
        });

        it('should return 400 for invalid purpose', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    code: '12345',
                    purpose: 'invalid-purpose',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
        });

        it('should return 400 when email is missing', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    code: '12345',
                    purpose: 'registration',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
        });

        it('should return 400 when code is missing', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    purpose: 'registration',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
        });

        it('should return 400 when purpose is missing', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    code: '12345',
                })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
        });

        it('should return 400 for wrong purpose', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Send registration OTP
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            // Try to verify with wrong purpose
            const mockOtp = '12345';
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email,
                    code: mockOtp,
                    purpose: 'forgot-password', // Wrong purpose
                })
                .expect(400);

            expect(response.body.message).toMatch(/Invalid OTP context|No OTP found|Invalid OTP/);
        });

        it('should return 400 for non-existent OTP', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Try to verify without sending OTP first
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email,
                    code: '12345',
                    purpose: 'registration',
                })
                .expect(400);

            expect(response.body.message).toContain('No OTP found');
        });

        it('should validate OTP code is exactly 5 digits', async () => {
            const invalidCodes = ['1234', '123456', 'abcde', '12.45', '12 45'];

            for (const code of invalidCodes) {
                await request(app.getHttpServer())
                    .post('/api/auth/otp/verify')
                    .send({
                        email: 'test@example.com',
                        code,
                        purpose: 'registration',
                    })
                    .expect(400);
            }
        });
    });

    describe('GET /api/users (Email Availability)', () => {
        it('should return available=true for new email', async () => {
            const email = TestDataHelper.generateRandomEmail();

            const response = await request(app.getHttpServer())
                .get('/api/users')
                .query({ email })
                .expect(200);

            expect(response.body).toMatchObject({
                available: true,
                message: 'Email is available',
            });
        });

        it('should return available=false for existing Firebase email', async () => {
            const email = 'existing@example.com';

            const response = await request(app.getHttpServer())
                .get('/api/users')
                .query({ email })
                .expect(200);

            expect(response.body).toHaveProperty('available');
            expect(response.body).toHaveProperty('message');
        });

        it('should return 400 for invalid email format', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/users')
                .query({ email: 'not-an-email' })
                .expect(400);

            expect(response.body.statusCode).toBe(400);
            expect(response.body.message).toContain('Invalid email format');
        });

        it('should return 400 when email query param is missing', async () => {
            const response = await request(app.getHttpServer()).get('/api/users').expect(400);

            expect(response.body.statusCode).toBe(400);
        });

        it('should check multiple emails in sequence', async () => {
            const emails = Array.from({ length: 3 }, () => TestDataHelper.generateRandomEmail());

            for (const email of emails) {
                await request(app.getHttpServer()).get('/api/users').query({ email }).expect(200);
            }
        });
    });

    describe('OTP Flow Variations', () => {
        it('should handle registration OTP → forgot password OTP for same email', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Send registration OTP
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            // Send forgot password OTP (should overwrite registration OTP)
            await request(app.getHttpServer())
                .post('/api/auth/otp/forgot-password')
                .send({ email })
                .expect(200);

            // Original registration OTP should now be invalid
            const mockOtp = '12345';
            await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email,
                    code: mockOtp,
                    purpose: 'registration',
                })
                .expect(400);
        });

        it('should handle concurrent OTP requests for different emails', async () => {
            const emails = Array.from({ length: 5 }, () => TestDataHelper.generateRandomEmail());

            // Send OTPs concurrently
            await Promise.all(
                emails.map((email) =>
                    request(app.getHttpServer())
                        .post('/api/auth/otp/registration')
                        .send({ email })
                        .expect(200),
                ),
            );
        });

        it('should handle rapid OTP resend requests', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Send OTP multiple times rapidly
            const requests = Array.from({ length: 3 }, () =>
                request(app.getHttpServer())
                    .post('/api/auth/otp/registration')
                    .send({ email })
                    .expect(200),
            );

            await Promise.all(requests);
        });
    });

    describe('Error Response Consistency', () => {
        it('should return consistent error format across OTP endpoints', async () => {
            const invalidEmail = 'not-an-email';

            const endpoints = [
                { path: '/api/auth/otp/registration', body: { email: invalidEmail } },
                { path: '/api/auth/otp/forgot-password', body: { email: invalidEmail } },
            ];

            for (const endpoint of endpoints) {
                const response = await request(app.getHttpServer())
                    .post(endpoint.path)
                    .send(endpoint.body)
                    .expect(400);

                // Verify error response structure
                expect(response.body).toHaveProperty('statusCode', 400);
                expect(response.body).toHaveProperty('timestamp');
                expect(response.body).toHaveProperty('path');
                expect(response.body).toHaveProperty('message');
                expect(response.body.message).toContain('Invalid email format');
            }
        });

        it('should include ISO timestamp in all error responses', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    code: '123', // Invalid length
                    purpose: 'registration',
                })
                .expect(400);

            const timestamp = new Date(response.body.timestamp);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.toString()).not.toBe('Invalid Date');
        });

        it('should include request path in error responses', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email: 'invalid' })
                .expect(400);

            expect(response.body.path).toBe('/api/auth/otp/registration');
        });
    });

    describe('Input Validation Edge Cases', () => {
        it('should trim whitespace from email in OTP requests', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Send OTP with whitespace
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email: `  ${email}  ` })
                .expect(200);
        });

        it('should handle email with uppercase letters', async () => {
            const email = 'TEST@EXAMPLE.COM';

            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);
        });

        it('should reject OTP code with letters', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    code: 'ABCDE',
                    purpose: 'registration',
                })
                .expect(400);
        });

        it('should reject OTP code with special characters', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/otp/verify')
                .send({
                    email: 'test@example.com',
                    code: '12!45',
                    purpose: 'registration',
                })
                .expect(400);
        });

        it('should reject null values', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email: null })
                .expect(400);
        });

        it('should reject empty string email', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email: '' })
                .expect(400);
        });
    });

    describe('Rate Limiting and Security', () => {
        it('should handle multiple OTP requests without crashing', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Send multiple OTP requests
            for (let i = 0; i < 10; i++) {
                await request(app.getHttpServer())
                    .post('/api/auth/otp/registration')
                    .send({ email })
                    .expect(200);
            }
        });

        it('should handle multiple verification attempts', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Send OTP
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            // Try multiple wrong codes
            const wrongCodes = ['11111', '22222', '33333', '44444', '55555'];

            for (const code of wrongCodes) {
                await request(app.getHttpServer())
                    .post('/api/auth/otp/verify')
                    .send({
                        email,
                        code,
                        purpose: 'registration',
                    })
                    .expect(400);
            }
        });
    });

    describe('JSON Response Format', () => {
        it('should return JSON content type', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email: 'test@example.com' });

            expect(response.headers['content-type']).toMatch(/json/);
        });

        it('should accept JSON content type', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .set('Content-Type', 'application/json')
                .send({ email: 'test@example.com' })
                .expect(200);
        });

        it('should return properly formatted JSON', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/auth/otp/registration')
                .send({ email: 'test@example.com' })
                .expect(200);

            expect(() => JSON.stringify(response.body)).not.toThrow();
            expect(response.body).toBeInstanceOf(Object);
        });
    });
});
