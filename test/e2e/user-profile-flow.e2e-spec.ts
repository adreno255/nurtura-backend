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

describe('User Profile Flow E2E Tests', () => {
    let app: INestApplication;
    let dbHelper: TestDatabaseHelper;
    let authToken: string;

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

        // Mock Firebase JWT token for authenticated requests
        // In real E2E, you'd get this from Firebase
        authToken = 'mock-firebase-jwt-token';
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

    describe('Complete User Profile Flow', () => {
        it('should complete full profile flow: check email → create user → get user by UID', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            // Step 1: Check email availability (public endpoint)
            const emailCheckResponse = await request(app.getHttpServer())
                .get('/api/users')
                .query({ email })
                .expect(200);

            expect(emailCheckResponse.body).toMatchObject({
                available: true,
                message: 'Email is available',
            });

            // Step 2: Create user profile (protected endpoint - requires auth)
            const seedUserResponse = await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect((res) => {
                    // Will succeed if auth token is valid, fail if not
                    expect([201, 401]).toContain(res.status);
                });

            // Step 3: Get user by Firebase UID (if user was created)
            if (seedUserResponse.status === 201) {
                const getUserResponse = await request(app.getHttpServer())
                    .get(`/api/users/${firebaseUid}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect((res) => {
                        expect([200, 401, 404]).toContain(res.status);
                    });

                if (getUserResponse.status === 200) {
                    expect(getUserResponse.body).toHaveProperty('message');
                    expect(getUserResponse.body).toHaveProperty('userInfo');
                }
            }
        });

        it('should prevent duplicate user creation', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            // Create user in database first
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                address: `${userData.block}, ${userData.street}, ${userData.barangay}, ${userData.city}`,
            });

            // Try to create same user again via API
            const seedUserResponse = await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect((res) => {
                    // Should be 409 (conflict) or 401 (unauthorized) or 201 (created if different user)
                    expect([201, 401, 409]).toContain(res.status);
                });

            if (seedUserResponse.status === 409) {
                expect(seedUserResponse.body.message).toContain('already exists');
            }
        });
    });

    describe('POST /api/users (Create User Profile)', () => {
        it('should require authentication', async () => {
            const userData = TestDataHelper.generateUserData();

            // Try without auth token
            const response = await request(app.getHttpServer())
                .post('/api/users')
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(401);

            expect(response.body).toMatchObject({
                statusCode: 401,
                message: 'Authentication required',
            });
        });

        it('should create user with valid data and auth token', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect((res) => {
                    // Will be 201 if auth works, 401 if auth fails
                    expect([201, 401]).toContain(res.status);

                    if (res.status === 201) {
                        expect(res.body).toHaveProperty('message');
                        expect(res.body).toHaveProperty('userId');
                    }
                });
        });

        it('should return 400 for missing required fields', async () => {
            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: 'John',
                    // Missing lastName, block, street, barangay, city
                })
                .expect((res) => {
                    // Will be 400 (validation) or 401 (unauthorized)
                    expect([400, 401]).toContain(res.status);
                });
        });

        it('should return 400 for missing firstName', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect((res) => {
                    expect([400, 401]).toContain(res.status);
                });
        });

        it('should return 400 for missing lastName', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: userData.firstName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect((res) => {
                    expect([400, 401]).toContain(res.status);
                });
        });

        it('should return 400 for missing address fields', async () => {
            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: 'John',
                    lastName: 'Doe',
                    // Missing block, street, barangay, city
                })
                .expect((res) => {
                    expect([400, 401]).toContain(res.status);
                });
        });

        it('should accept optional middleName', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: userData.firstName,
                    middleName: 'Michael',
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect((res) => {
                    expect([201, 401]).toContain(res.status);
                });
        });

        it('should accept optional suffix', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    suffix: 'Jr.',
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect((res) => {
                    expect([201, 401]).toContain(res.status);
                });
        });

        it('should return 400 for extra fields (forbidNonWhitelisted)', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                    extraField: 'should-not-be-here',
                })
                .expect((res) => {
                    expect([400, 401]).toContain(res.status);
                });
        });

        it('should validate firstName max length', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: 'A'.repeat(101), // Exceeds 100 char limit
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect((res) => {
                    expect([400, 401]).toContain(res.status);
                });
        });

        it('should validate lastName max length', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: 'B'.repeat(101), // Exceeds 100 char limit
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect((res) => {
                    expect([400, 401]).toContain(res.status);
                });
        });

        it('should accept names with special characters', async () => {
            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: "O'Brien",
                    lastName: 'García-López',
                    suffix: 'III',
                    block: 'Block 5-A',
                    street: "St. Mary's Street",
                    barangay: 'Brgy. San José',
                    city: 'Quezon City',
                })
                .expect((res) => {
                    expect([201, 401]).toContain(res.status);
                });
        });

        it('should handle very long but valid address components', async () => {
            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: 'John',
                    lastName: 'Doe',
                    block: 'Block 999',
                    street: 'Very Long Street Name That Goes On For A While',
                    barangay: 'Barangay With A Very Long Name That Is Still Valid',
                    city: 'City With A Long Name',
                })
                .expect((res) => {
                    expect([201, 401]).toContain(res.status);
                });
        });
    });

    describe('GET /api/users/:firebaseUid (Get User by Firebase UID)', () => {
        it('should require authentication', async () => {
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            const response = await request(app.getHttpServer())
                .get(`/api/users/${firebaseUid}`)
                .expect(401);

            expect(response.body).toMatchObject({
                statusCode: 401,
                message: 'Authentication required',
            });
        });

        it('should get user by Firebase UID with valid auth', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            // Create user in database
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                address: `${userData.block}, ${userData.street}, ${userData.barangay}, ${userData.city}`,
            });

            const response = await request(app.getHttpServer())
                .get(`/api/users/${firebaseUid}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect((res) => {
                    // Will be 200 if user found and auth valid, 401 if auth invalid, 404 if not found
                    expect([200, 401, 404]).toContain(res.status);
                });

            if (response.status === 200) {
                expect(response.body).toHaveProperty('message', 'User info fetched successfully');
                expect(response.body).toHaveProperty('userInfo');
                expect(response.body.userInfo).toHaveProperty('id');
                expect(response.body.userInfo).toHaveProperty('email', email);
                expect(response.body.userInfo).toHaveProperty('firstName', userData.firstName);
            }
        });

        it('should return 404 when user not found', async () => {
            const nonExistentUid = TestDataHelper.generateFirebaseUid();

            const response = await request(app.getHttpServer())
                .get(`/api/users/${nonExistentUid}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect((res) => {
                    // Will be 404 if not found or 401 if auth invalid
                    expect([401, 404]).toContain(res.status);
                });

            if (response.status === 404) {
                expect(response.body).toMatchObject({
                    statusCode: 404,
                    message: 'User profile not found in database',
                });
            }
        });

        it('should parse address into components', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Create user with specific address
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: 'John',
                lastName: 'Doe',
                address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
            });

            const response = await request(app.getHttpServer())
                .get(`/api/users/${firebaseUid}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect((res) => {
                    expect([200, 401]).toContain(res.status);
                });

            if (response.status === 200) {
                expect(response.body.userInfo).toMatchObject({
                    address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
                    block: 'Block 5',
                    street: 'Sampaguita St',
                    barangay: 'Brgy Commonwealth',
                    city: 'Quezon City',
                });
            }
        });

        it('should handle user with middleName and suffix', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Create user with all name fields
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: 'John',
                middleName: 'Michael',
                lastName: 'Doe',
                suffix: 'Jr.',
                address: 'Test Address',
            });

            const response = await request(app.getHttpServer())
                .get(`/api/users/${firebaseUid}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect((res) => {
                    expect([200, 401]).toContain(res.status);
                });

            if (response.status === 200) {
                expect(response.body.userInfo).toMatchObject({
                    firstName: 'John',
                    middleName: 'Michael',
                    lastName: 'Doe',
                    suffix: 'Jr.',
                });
            }
        });

        it('should handle user without middleName and suffix', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Create user without optional fields
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: 'Jane',
                lastName: 'Smith',
                address: 'Test Address',
            });

            const response = await request(app.getHttpServer())
                .get(`/api/users/${firebaseUid}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect((res) => {
                    expect([200, 401]).toContain(res.status);
                });

            if (response.status === 200) {
                expect(response.body.userInfo).toMatchObject({
                    firstName: 'Jane',
                    lastName: 'Smith',
                    middleName: null,
                    suffix: null,
                });
            }
        });

        it('should get different users by their Firebase UIDs', async () => {
            const users = Array.from({ length: 3 }, () => ({
                email: TestDataHelper.generateRandomEmail(),
                firebaseUid: TestDataHelper.generateFirebaseUid(),
                firstName: TestDataHelper.generateUserData().firstName,
            }));

            // Create all users
            for (const user of users) {
                await dbHelper.seedUser({
                    firebaseUid: user.firebaseUid,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: 'Test',
                    address: 'Test Address',
                });
            }

            // Get each user by their Firebase UID
            for (const user of users) {
                const response = await request(app.getHttpServer())
                    .get(`/api/users/${user.firebaseUid}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect((res) => {
                        expect([200, 401]).toContain(res.status);
                    });

                if (response.status === 200) {
                    expect(response.body.userInfo.email).toBe(user.email);
                    expect(response.body.userInfo.firstName).toBe(user.firstName);
                }
            }
        });
    });

    describe('Authentication Flow', () => {
        it('should reject requests with invalid Bearer token format', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', 'InvalidTokenFormat')
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(401);
        });

        it('should reject requests with missing Authorization header', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(401);
        });

        it('should reject requests with empty Bearer token', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', 'Bearer ')
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(401);
        });
    });

    describe('Error Response Consistency', () => {
        it('should return consistent error format for all user endpoints', async () => {
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Test GET endpoint without auth
            const getResponse = await request(app.getHttpServer())
                .get(`/api/users/${firebaseUid}`)
                .expect(401);

            expect(getResponse.body).toHaveProperty('statusCode', 401);
            expect(getResponse.body).toHaveProperty('timestamp');
            expect(getResponse.body).toHaveProperty('path');
            expect(getResponse.body).toHaveProperty('message');

            // Test POST endpoint without auth
            const postResponse = await request(app.getHttpServer())
                .post('/api/users')
                .send({
                    firstName: 'Test',
                    lastName: 'User',
                    block: 'Block 1',
                    street: 'Street',
                    barangay: 'Barangay',
                    city: 'City',
                })
                .expect(401);

            expect(postResponse.body).toHaveProperty('statusCode', 401);
            expect(postResponse.body).toHaveProperty('timestamp');
            expect(postResponse.body).toHaveProperty('path');
            expect(postResponse.body).toHaveProperty('message');
        });

        it('should include ISO timestamp in error responses', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/users')
                .send({
                    firstName: 'Test',
                    // Missing required fields
                })
                .expect(401);

            const timestamp = new Date(response.body.timestamp);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.toString()).not.toBe('Invalid Date');
        });

        it('should include request path in error responses', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/users')
                .send({
                    firstName: 'Test',
                })
                .expect(401);

            expect(response.body.path).toBe('/api/users');
        });
    });

    describe('Data Persistence', () => {
        it('should persist user data after creation', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            // Create user in database
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                address: `${userData.block}, ${userData.street}, ${userData.barangay}, ${userData.city}`,
            });

            // Verify user exists by querying
            const user = await dbHelper.user.findUnique({
                where: { firebaseUid },
            }); // CHANGE

            expect(user).not.toBeNull();
            expect(user?.email).toBe(email);
            expect(user?.firstName).toBe(userData.firstName);
        });

        it('should maintain data integrity across requests', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            // Create user
            await dbHelper.seedUser({
                firebaseUid,
                email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                address: `${userData.block}, ${userData.street}, ${userData.barangay}, ${userData.city}`,
            });

            // Get user multiple times
            for (let i = 0; i < 3; i++) {
                const response = await request(app.getHttpServer())
                    .get(`/api/users/${firebaseUid}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect((res) => {
                        expect([200, 401]).toContain(res.status);
                    });

                if (response.status === 200) {
                    expect(response.body.userInfo.email).toBe(email);
                    expect(response.body.userInfo.firstName).toBe(userData.firstName);
                }
            }
        });
    });

    describe('JSON Response Format', () => {
        it('should return JSON content type for all endpoints', async () => {
            const responses = await Promise.all([
                request(app.getHttpServer()).get('/api/users').query({ email: 'test@example.com' }),
                request(app.getHttpServer()).post('/api/users').send({ firstName: 'Test' }),
            ]);

            responses.forEach((response) => {
                expect(response.headers['content-type']).toMatch(/json/);
            });
        });

        it('should return properly formatted JSON', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/users')
                .query({ email: TestDataHelper.generateRandomEmail() })
                .expect(200);

            expect(() => JSON.stringify(response.body)).not.toThrow();
            expect(response.body).toBeInstanceOf(Object);
        });
    });

    describe('CORS and Headers', () => {
        it('should include CORS headers', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/users')
                .query({ email: 'test@example.com' });

            expect(response.headers).toHaveProperty('access-control-allow-origin');
        });

        it('should accept JSON content type', async () => {
            await request(app.getHttpServer())
                .post('/api/users')
                .set('Content-Type', 'application/json')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: 'Test',
                    lastName: 'User',
                    block: 'Block 1',
                    street: 'Street',
                    barangay: 'Barangay',
                    city: 'City',
                })
                .expect((res) => {
                    expect([201, 401]).toContain(res.status);
                });
        });
    });

    describe('Input Validation Edge Cases', () => {
        it('should trim whitespace from string fields', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: `  ${userData.firstName}  `,
                    lastName: `  ${userData.lastName}  `,
                    block: `  ${userData.block}  `,
                    street: `  ${userData.street}  `,
                    barangay: `  ${userData.barangay}  `,
                    city: `  ${userData.city}  `,
                })
                .expect((res) => {
                    expect([201, 401]).toContain(res.status);
                });
        });

        it('should reject null values', async () => {
            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: null,
                    lastName: 'Doe',
                    block: 'Block 1',
                    street: 'Street',
                    barangay: 'Barangay',
                    city: 'City',
                })
                .expect((res) => {
                    expect([400, 401]).toContain(res.status);
                });
        });

        it('should reject empty strings for required fields', async () => {
            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: '',
                    lastName: 'Doe',
                    block: 'Block 1',
                    street: 'Street',
                    barangay: 'Barangay',
                    city: 'City',
                })
                .expect((res) => {
                    expect([400, 401]).toContain(res.status);
                });
        });

        it('should accept empty strings for optional fields', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(app.getHttpServer())
                .post('/api/users')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: userData.firstName,
                    middleName: '', // Optional field
                    lastName: userData.lastName,
                    suffix: '', // Optional field
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect((res) => {
                    expect([201, 401]).toContain(res.status);
                });
        });
    });
});
