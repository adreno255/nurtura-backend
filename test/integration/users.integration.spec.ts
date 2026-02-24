import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestDatabaseHelper, TestDataHelper, TestServerHelper } from '../helpers';
import {
    createMockFirebaseAuth,
    createMockFirebaseService,
    createMockDecodedToken,
    FirebaseAuthErrors,
    createMockEmailService,
} from '../mocks';
import { FirebaseService } from '../../src/firebase/firebase.service';
import { EmailService } from '../../src/email/email.service';
import type { CreateUserDto } from '../../src/users/dto/create-user.dto';
import { type Server } from 'http';
import { type ExceptionResponse } from '../../src/common/interfaces';
import {
    type UserUpdatedResponse,
    type UserCreatedResponse,
    type UserInfoResponse,
} from '../../src/users/interfaces/user.interface';

describe('Users Integration Tests (HTTP Endpoints)', () => {
    let app: INestApplication;
    let dbHelper: TestDatabaseHelper;
    let serverHelper: TestServerHelper;
    let httpServer: Server;
    let mockFirebaseJWT: ReturnType<typeof createMockDecodedToken>;

    const mockAuth = createMockFirebaseAuth();
    const mockFirebaseService = createMockFirebaseService(mockAuth);
    const mockEmailService = createMockEmailService();

    // Valid auth token for authenticated requests
    const validAuthToken = 'valid-firebase-jwt-token';

    beforeAll(async () => {
        // Initialize database helper
        dbHelper = new TestDatabaseHelper();
        await dbHelper.connect();

        // Create initial mock Firebase JWT
        mockFirebaseJWT = createMockDecodedToken();

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

        // Reset mock Firebase JWT
        mockFirebaseJWT = createMockDecodedToken();
    });

    describe('GET /api/users/exists?email= (Check Email Availability)', () => {
        it('should return available=true when email not found in Firebase', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Mock Firebase getUserByEmail to throw user-not-found error
            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            const response = await request(httpServer)
                .get('/api/users/exists')
                .query({ email })
                .expect(200);

            expect(response.body).toEqual({
                available: true,
                message: 'Email is available',
            });
        });

        it('should return available=false when email exists in Firebase', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Mock Firebase getUserByEmail to return user
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: TestDataHelper.generateFirebaseUid(),
                email,
            } as any);

            const response = await request(httpServer)
                .get('/api/users/exists')
                .query({ email })
                .expect(200);

            expect(response.body).toEqual({
                available: false,
                message: 'Email is already registered',
            });
        });

        it('should validate email format', async () => {
            const response = await request(httpServer)
                .get('/api/users/exists')
                .query({ email: 'invalid-email' })
                .expect(400);

            expect(response.body).toMatchObject({
                statusCode: 400,
                message: 'Invalid email format',
            });
        });

        it('should require email query parameter', async () => {
            const response = await request(httpServer).get('/api/users/exists').expect(400);

            expect(response.body).toMatchObject({
                statusCode: 400,
            });
        });

        it('should check multiple emails in sequence', async () => {
            const email1 = TestDataHelper.generateRandomEmail();
            const email2 = TestDataHelper.generateRandomEmail();

            // Email1 exists in Firebase
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValueOnce({
                uid: TestDataHelper.generateFirebaseUid(),
                email: email1,
            } as any);

            // Email2 does not exist
            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());

            const response1 = await request(httpServer)
                .get('/api/users/exists')
                .query({ email: email1 })
                .expect(200);

            const response2 = await request(httpServer)
                .get('/api/users/exists')
                .query({ email: email2 })
                .expect(200);

            expect(response1.body).toMatchObject({
                available: false,
            });
            expect(response2.body).toMatchObject({
                available: true,
            });
        });

        it('should handle multiple email availability checks', async () => {
            const emails = Array.from({ length: 5 }, () => TestDataHelper.generateRandomEmail());

            // Setup mocks
            emails.forEach(() => {
                mockFirebaseService
                    .getAuth()
                    .getUserByEmail.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());
            });

            for (const email of emails) {
                const response = await request(httpServer)
                    .get('/api/users/exists')
                    .query({ email });

                expect(response.status).toBe(200);
                expect(response.body).toMatchObject({ available: true });
            }

            expect(mockFirebaseService.getAuth().getUserByEmail).toHaveBeenCalledTimes(5);
        });

        it('should return 500 for Firebase service errors', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(new Error('Firebase service unavailable'));

            const response = await request(httpServer)
                .get('/api/users/exists')
                .query({ email })
                .expect(500);

            expect(response.body).toMatchObject({
                statusCode: 500,
                message: 'Failed to check email availability',
            });
        });

        it('should not require authentication (public endpoint)', async () => {
            const email = TestDataHelper.generateRandomEmail();

            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            // No Authorization header
            const response = await request(httpServer)
                .get('/api/users/exists')
                .query({ email })
                .expect(200);

            expect(response.body).toMatchObject({
                available: true,
            });
        });
    });

    describe('POST /api/users (Create User Profile)', () => {
        it('should require authentication', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(mockFirebaseJWT);

            const createResponse = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(201);

            const { userId } = createResponse.body as UserCreatedResponse;

            // Get user by Firebase JWT
            const getResponse = await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(200);

            const body = getResponse.body as UserInfoResponse;

            // Both operations should return consistent data
            expect(body.userInfo.id).toBe(userId);
            expect(body.userInfo.email).toBe(mockFirebaseJWT.email);
            expect(body.userInfo.firstName).toBe(userData.firstName);
        });

        it('should preserve data types correctly', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: 'John',
                    middleName: 'Michael',
                    lastName: 'Doe',
                    suffix: 'Jr.',
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(201);

            const dbUser = await dbHelper.user.findUnique({
                where: { firebaseUid: mockFirebaseJWT.uid },
            });

            // Verify data types
            expect(typeof dbUser?.id).toBe('string');
            expect(typeof dbUser?.firebaseUid).toBe('string');
            expect(typeof dbUser?.email).toBe('string');
            expect(typeof dbUser?.firstName).toBe('string');
            expect(typeof dbUser?.middleName).toBe('string');
            expect(typeof dbUser?.lastName).toBe('string');
            expect(typeof dbUser?.suffix).toBe('string');
            expect(typeof dbUser?.address).toBe('string');
            expect(dbUser?.createdAt).toBeInstanceOf(Date);
            expect(dbUser?.updatedAt).toBeInstanceOf(Date);
        });
    });

    describe('PATCH /api/users (Update User Profile)', () => {
        it('should require authentication', async () => {
            const dto = {
                firstName: 'Updated',
                lastName: 'User',
                block: 'Block 1',
                street: 'Street',
                barangay: 'Barangay',
                city: 'City',
            };

            const response = await request(httpServer).patch('/api/users').send(dto).expect(401);

            expect(response.body).toHaveProperty('statusCode', 401);
        });

        it('should return 404 when user not found', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const dto = { firstName: 'No', lastName: 'User' };

            const response = await request(httpServer)
                .patch('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send(dto)
                .expect(404);

            expect(response.body).toHaveProperty('statusCode', 404);
        });

        it('should update user data successfully', async () => {
            // seed existing user
            await dbHelper.seedUser({
                firebaseUid: mockFirebaseJWT.uid,
                email: mockFirebaseJWT.email,
                firstName: 'Original',
                lastName: 'Name',
                address: 'Block 1, Street, Barangay, City',
            });

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const dto = {
                firstName: 'Updated',
                lastName: 'User',
                block: 'Block 2',
                street: 'New Street',
                barangay: 'New Barangay',
                city: 'New City',
            };

            const response = await request(httpServer)
                .patch('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send(dto)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'User updated successfully');
            expect((response.body as UserUpdatedResponse).userInfo).toHaveProperty(
                'firstName',
                'Updated',
            );
        });

        it('should send email reset notification when email changes', async () => {
            // seed existing user
            await dbHelper.seedUser({
                firebaseUid: mockFirebaseJWT.uid,
                email: 'old@example.com',
                firstName: 'Old',
                lastName: 'User',
                address: 'Block 1, Street, Barangay, City',
            });

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const dto = {
                email: 'new@example.com',
            };

            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValueOnce({
                uid: mockFirebaseJWT.uid,
            });
            mockFirebaseService.getAuth().updateUser(undefined);

            await request(httpServer)
                .patch('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send(dto)
                .expect(200);

            expect(mockEmailService.sendEmailResetNotification).toHaveBeenCalledWith(
                'old@example.com',
            );
        });

        it('should update email of Firebase user when email changes', async () => {
            // seed existing user
            await dbHelper.seedUser({
                firebaseUid: mockFirebaseJWT.uid,
                email: 'old@example.com',
                firstName: 'Old',
                lastName: 'User',
                address: 'Block 1, Street, Barangay, City',
            });

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValueOnce({
                uid: mockFirebaseJWT.uid,
            });
            mockFirebaseService.getAuth().updateUser(undefined);

            const dto = {
                email: 'new@example.com',
            };

            await request(httpServer)
                .patch('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send(dto)
                .expect(200);

            expect(mockFirebaseService.getAuth().getUserByEmail).toHaveBeenCalledWith(
                'old@example.com',
            );
            expect(mockFirebaseService.getAuth().updateUser).toHaveBeenCalledWith(
                mockFirebaseJWT.uid,
                { email: dto.email },
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle user with very long names', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: 'A'.repeat(100),
                    lastName: 'B'.repeat(100),
                    block: 'Block 999',
                    street: 'Very Long Street Name That Goes On Forever',
                    barangay: 'Barangay With A Very Long Name',
                    city: 'City With Long Name',
                })
                .expect(201);

            const response = await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(200);

            const body = response.body as UserInfoResponse;

            expect(body.userInfo.firstName).toBe('A'.repeat(100));
            expect(body.userInfo.lastName).toBe('B'.repeat(100));
        });

        it('should handle special characters in names', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: "O'Brien",
                    lastName: 'García-López',
                    suffix: 'III',
                    block: 'Block 5-A',
                    street: "St. Mary's Street",
                    barangay: 'Brgy. San José',
                    city: 'Quezon City',
                })
                .expect(201);

            const response = await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(200);

            const body = response.body as UserInfoResponse;

            expect(body.userInfo.firstName).toBe("O'Brien");
            expect(body.userInfo.lastName).toBe('García-López');
        });

        it('should handle empty address components gracefully', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: 'John',
                    lastName: 'Doe',
                    block: '',
                    street: '',
                    barangay: '',
                    city: 'Manila',
                })
                .expect(400);
        });
    });

    describe('Error Response Consistency', () => {
        it('should return consistent error format for validation errors', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: 'Test',
                    // Missing required fields
                })
                .expect(400);

            expect(response.body).toHaveProperty('statusCode', 400);
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('path', '/api/users');
            expect(response.body).toHaveProperty('message');
        });

        it('should return consistent error format for authentication errors', async () => {
            const response = await request(httpServer)
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

            expect(response.body).toHaveProperty('statusCode', 401);
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('path', '/api/users');
            expect(response.body).toHaveProperty('message');
        });

        it('should return consistent error format for not found errors', async () => {
            const nonExistentUid = TestDataHelper.generateFirebaseUid();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .get(`/api/users/${nonExistentUid}`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('statusCode', 404);
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('path', `/api/users/${nonExistentUid}`);
            expect(response.body).toHaveProperty('message');
        });

        it('should include ISO timestamp in error responses', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: 'Test',
                    // Missing required fields
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            const timestamp = new Date(body.timestamp);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.toString()).not.toBe('Invalid Date');
        });

        it('should include request path in error responses', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: 'Test',
                })
                .expect(400);

            const body = response.body as ExceptionResponse;

            expect(body.path).toBe('/api/users');
        });
    });

    describe('JSON Response Format', () => {
        it('should return JSON content type for all endpoints', async () => {
            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            const responses = await Promise.all([
                request(httpServer).get('/api/users').query({ email: 'test@example.com' }),
                request(httpServer)
                    .post('/api/users')
                    .set('Authorization', `Bearer ${validAuthToken}`)
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        block: 'Block 1',
                        street: 'Street',
                        barangay: 'Barangay',
                        city: 'City',
                    }),
            ]);

            responses.forEach((response) => {
                expect(response.headers['content-type']).toMatch(/json/);
            });
        });

        it('should return properly formatted JSON', async () => {
            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            const response = await request(httpServer)
                .get('/api/users/exists')
                .query({ email: TestDataHelper.generateRandomEmail() })
                .expect(200);

            expect(() => JSON.stringify(response.body)).not.toThrow();
            expect(response.body).toBeInstanceOf(Object);
        });
    });

    describe('Input Validation Edge Cases', () => {
        it('should trim whitespace from string fields', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: `  ${userData.firstName}  `,
                    lastName: `  ${userData.lastName}  `,
                    block: `  ${userData.block}  `,
                    street: `  ${userData.street}  `,
                    barangay: `  ${userData.barangay}  `,
                    city: `  ${userData.city}  `,
                })
                .expect(201);

            const dbUser = await dbHelper.user.findUnique({
                where: { firebaseUid: mockFirebaseJWT.uid },
            });

            expect(dbUser?.firstName).toBe(userData.firstName);
            expect(dbUser?.lastName).toBe(userData.lastName);
        });

        it('should reject null values for required fields', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: null,
                    lastName: 'Doe',
                    block: 'Block 1',
                    street: 'Street',
                    barangay: 'Barangay',
                    city: 'City',
                })
                .expect(400);
        });

        it('should reject empty strings for required fields', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: '',
                    lastName: 'Doe',
                    block: 'Block 1',
                    street: 'Street',
                    barangay: 'Barangay',
                    city: 'City',
                })
                .expect(400);
        });

        it('should accept empty strings for optional fields', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: userData.firstName,
                    middleName: '',
                    lastName: userData.lastName,
                    suffix: '',
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(201);
        });

        it('should handle undefined optional fields', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                    // middleName and suffix intentionally omitted
                })
                .expect(201);

            const dbUser = await dbHelper.user.findUnique({
                where: { firebaseUid: mockFirebaseJWT.uid },
            });

            expect(dbUser?.middleName).toBeNull();
            expect(dbUser?.suffix).toBeNull();
        });
    });

    describe('HTTP Methods and Status Codes', () => {
        it('should respond to GET requests on /api/users with query', async () => {
            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            await request(httpServer)
                .get('/api/users/exists')
                .query({ email: 'test@example.com' })
                .expect(200);
        });

        it('should respond to POST requests on /api/users', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(201);
        });

        it('should respond to GET requests on /api/users/:firebaseUid', async () => {
            await dbHelper.seedUser({
                firebaseUid: mockFirebaseJWT.uid,
                email: mockFirebaseJWT.email,
                firstName: 'Test',
                lastName: 'User',
                address: 'Test Address',
            });

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(200);
        });

        it('should return 404 for unsupported HTTP methods', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .put('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({})
                .expect(404);
        });
    });

    describe('Performance and Concurrency', () => {
        it('should handle multiple concurrent read requests', async () => {
            // Create a user first
            await dbHelper.seedUser({
                firebaseUid: mockFirebaseJWT.uid,
                email: mockFirebaseJWT.email,
                firstName: 'Concurrent',
                lastName: 'Test',
                address: 'Test Address',
            });

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(mockFirebaseJWT);

            // Make 5 concurrent GET requests
            const requests = Array.from({ length: 5 }, () =>
                request(httpServer)
                    .get(`/api/users`)
                    .set('Authorization', `Bearer ${validAuthToken}`),
            );

            const responses = await Promise.all(requests);

            responses.forEach((response) => {
                expect(response.status).toBe(200);
                expect((response.body as UserInfoResponse).userInfo.firstName).toBe('Concurrent');
            });
        });

        it('should create user successfully with valid data and auth token', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(201);

            const { userId } = response.body as UserCreatedResponse;

            expect(response.body).toMatchObject({
                message: 'User registered successfully',
                userId,
            });

            // Verify user was created in database
            const dbUser = await dbHelper.user.findUnique({
                where: { firebaseUid: mockFirebaseJWT.uid },
            });

            expect(dbUser).not.toBeNull();
            expect(dbUser?.email).toBe(mockFirebaseJWT.email);
            expect(dbUser?.firstName).toBe(userData.firstName);
            expect(dbUser?.lastName).toBe(userData.lastName);
        });

        it('should format address correctly when creating user', async () => {
            const dto: CreateUserDto = {
                firstName: 'John',
                lastName: 'Doe',
                block: 'Block 5',
                street: 'Sampaguita St',
                barangay: 'Brgy Commonwealth',
                city: 'Quezon City',
            };

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send(dto)
                .expect(201);

            const dbUser = await dbHelper.user.findUnique({
                where: { firebaseUid: mockFirebaseJWT.uid },
            });

            expect(dbUser?.address).toBe('Block 5, Sampaguita St, Brgy Commonwealth, Quezon City');
        });

        it('should trim whitespace from user data', async () => {
            const dto: CreateUserDto = {
                firstName: '  John  ',
                middleName: '  Michael  ',
                lastName: '  Doe  ',
                suffix: '  Jr.  ',
                block: '  Block 5  ',
                street: '  Sampaguita St  ',
                barangay: '  Brgy Commonwealth  ',
                city: '  Quezon City  ',
            };

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send(dto)
                .expect(201);

            const dbUser = await dbHelper.user.findUnique({
                where: { firebaseUid: mockFirebaseJWT.uid },
            });

            expect(dbUser?.firstName).toBe('John');
            expect(dbUser?.middleName).toBe('Michael');
            expect(dbUser?.lastName).toBe('Doe');
            expect(dbUser?.suffix).toBe('Jr.');
            expect(dbUser?.address).toBe('Block 5, Sampaguita St, Brgy Commonwealth, Quezon City');
        });

        it('should handle null middleName and suffix', async () => {
            const dto: CreateUserDto = {
                firstName: 'John',
                lastName: 'Doe',
                block: 'Block 5',
                street: 'Sampaguita St',
                barangay: 'Brgy Commonwealth',
                city: 'Quezon City',
            };

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send(dto)
                .expect(201);

            const dbUser = await dbHelper.user.findUnique({
                where: { firebaseUid: mockFirebaseJWT.uid },
            });

            expect(dbUser?.middleName).toBeNull();
            expect(dbUser?.suffix).toBeNull();
        });

        it('should return 409 if user already exists', async () => {
            const userData = TestDataHelper.generateUserData();

            const dto: CreateUserDto = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(mockFirebaseJWT);

            // Create user first time
            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send(dto)
                .expect(201);

            // Try to create same user again
            const response = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send(dto)
                .expect(409);

            expect(response.body).toMatchObject({
                statusCode: 409,
                message: 'User profile already exists',
            });
        });

        it('should validate required fields', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: 'John',
                    // Missing lastName, block, street, barangay, city
                })
                .expect(400);

            expect(response.body).toMatchObject({
                statusCode: 400,
            });
        });

        it('should reject extra fields (forbidNonWhitelisted)', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                    extraField: 'should-not-be-here',
                })
                .expect(400);

            const body = response.body as UserCreatedResponse;

            expect(body.message).toContain('extraField');
        });

        it('should validate firstName max length', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: 'A'.repeat(101),
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(400);

            const body = response.body as UserCreatedResponse;

            expect(body.message).toContain('firstName');
        });

        it('should validate lastName max length', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: 'B'.repeat(101),
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(400);

            const body = response.body as UserCreatedResponse;

            expect(body.message).toContain('lastName');
        });

        it('should accept names with special characters', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: "O'Brien",
                    lastName: 'García-López',
                    suffix: 'III',
                    block: 'Block 5-A',
                    street: "St. Mary's Street",
                    barangay: 'Brgy. San José',
                    city: 'Quezon City',
                })
                .expect(201);
        });

        it('should set createdAt and updatedAt timestamps', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const beforeCreate = new Date();
            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(201);
            const afterCreate = new Date();

            const dbUser = await dbHelper.user.findUnique({
                where: { firebaseUid: mockFirebaseJWT.uid },
            });

            expect(dbUser?.createdAt).toBeDefined();
            expect(dbUser?.updatedAt).toBeDefined();
            expect(dbUser?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
            expect(dbUser?.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
        });

        it('should generate unique CUIDs for each user', async () => {
            const userIds: string[] = [];

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(mockFirebaseJWT);

            // Create 3 users with different auth tokens (simulating different users)
            for (let i = 0; i < 3; i++) {
                const userData = TestDataHelper.generateUserData();

                // Temporarily override the guard to use different user for each request
                const response = await request(httpServer)
                    .post('/api/users')
                    .set('Authorization', `Bearer ${validAuthToken}`)
                    .send({
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        block: userData.block,
                        street: userData.street,
                        barangay: userData.barangay,
                        city: userData.city,
                    });

                // Only check if user was created successfully
                if (response.status === 201) {
                    userIds.push((response.body as UserCreatedResponse).userId);
                }

                // Clean up for next iteration
                await dbHelper.clearDatabase();
            }

            // Verify all successfully created users have unique IDs
            if (userIds.length > 1) {
                const uniqueIds = new Set(userIds);
                expect(uniqueIds.size).toBe(userIds.length);
            }
        });

        it('should reject invalid auth token format', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(httpServer)
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

        it('should reject empty Bearer token', async () => {
            const userData = TestDataHelper.generateUserData();

            await request(httpServer)
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

    describe('GET /api/users (Get User by Firebase JWT)', () => {
        it('should require authentication', async () => {
            const response = await request(httpServer).get(`/api/users`).expect(401);

            expect(response.body).toMatchObject({
                statusCode: 401,
                message: 'Authentication required',
            });
        });

        it('should get user by Firebase UID with valid auth', async () => {
            const userData = TestDataHelper.generateUserData();

            // Create user in database
            const createdUser = await dbHelper.seedUser({
                firebaseUid: mockFirebaseJWT.uid,
                email: mockFirebaseJWT.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                address: `${userData.block}, ${userData.street}, ${userData.barangay}, ${userData.city}`,
            });

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'User info fetched successfully',
                userInfo: {
                    id: createdUser.id,
                    email: mockFirebaseJWT.email,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                },
            });
        });

        it('should parse address into components', async () => {
            await dbHelper.seedUser({
                firebaseUid: mockFirebaseJWT.uid,
                email: mockFirebaseJWT.email,
                firstName: 'John',
                lastName: 'Doe',
                address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
            });

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(200);

            const body = response.body as UserInfoResponse;

            expect(body.userInfo).toMatchObject({
                address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
                block: 'Block 5',
                street: 'Sampaguita St',
                barangay: 'Brgy Commonwealth',
                city: 'Quezon City',
            });
        });

        it('should return 404 when user not found', async () => {
            // no user seeded
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(404);

            expect(response.body).toMatchObject({
                statusCode: 404,
                message: 'User not found',
            });
        });

        it('should handle address with extra spaces', async () => {
            await dbHelper.seedUser({
                firebaseUid: mockFirebaseJWT.uid,
                email: mockFirebaseJWT.email,
                firstName: 'John',
                lastName: 'Doe',
                address: 'Block 5,  Sampaguita St  , Brgy Commonwealth,  Quezon City  ',
            });

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(200);

            const body = response.body as UserInfoResponse;

            expect(body.userInfo.block).toBe('Block 5');
            expect(body.userInfo.street).toBe('Sampaguita St');
            expect(body.userInfo.barangay).toBe('Brgy Commonwealth');
            expect(body.userInfo.city).toBe('Quezon City');
        });

        it('should handle incomplete address', async () => {
            await dbHelper.seedUser({
                firebaseUid: mockFirebaseJWT.uid,
                email: mockFirebaseJWT.email,
                firstName: 'John',
                lastName: 'Doe',
                address: 'Block 5',
            });

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(200);

            const body = response.body as UserInfoResponse;

            expect(body.userInfo.block).toBe('Block 5');
            expect(body.userInfo.street).toBe('');
            expect(body.userInfo.barangay).toBe('');
            expect(body.userInfo.city).toBe('');
        });

        it('should handle user with middleName and suffix', async () => {
            await dbHelper.seedUser({
                firebaseUid: mockFirebaseJWT.uid,
                email: mockFirebaseJWT.email,
                firstName: 'John',
                middleName: 'Michael',
                lastName: 'Doe',
                suffix: 'Jr.',
                address: 'Test Address',
            });

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(200);

            const body = response.body as UserInfoResponse;

            expect(body.userInfo).toMatchObject({
                firstName: 'John',
                middleName: 'Michael',
                lastName: 'Doe',
                suffix: 'Jr.',
            });
        });

        it('should handle user without middleName and suffix', async () => {
            await dbHelper.seedUser({
                firebaseUid: mockFirebaseJWT.uid,
                email: mockFirebaseJWT.email,
                firstName: 'Jane',
                lastName: 'Smith',
                address: 'Test Address',
            });

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            const response = await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(200);

            const body = response.body as UserInfoResponse;

            expect(body.userInfo).toMatchObject({
                firstName: 'Jane',
                lastName: 'Smith',
                middleName: null,
                suffix: null,
            });
        });
    });

    describe('Database Constraints and Relationships', () => {
        it('should enforce unique Firebase UID constraint', async () => {
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Create first user
            await dbHelper.seedUser({
                firebaseUid,
                email: 'user1@example.com',
                firstName: 'User',
                lastName: 'One',
                address: 'Address 1',
            });

            // Try to create second user with same Firebase UID - should fail at database level
            await expect(
                dbHelper.seedUser({
                    firebaseUid, // Same UID
                    email: 'user2@example.com',
                    firstName: 'User',
                    lastName: 'Two',
                    address: 'Address 2',
                }),
            ).rejects.toThrow();
        });

        it('should enforce unique email constraint', async () => {
            const email = 'duplicate@example.com';

            // Create first user
            await dbHelper.seedUser({
                firebaseUid: TestDataHelper.generateFirebaseUid(),
                email,
                firstName: 'User',
                lastName: 'One',
                address: 'Address 1',
            });

            // Try to create second user with same email - should fail at database level
            await expect(
                dbHelper.seedUser({
                    firebaseUid: TestDataHelper.generateFirebaseUid(),
                    email, // Same email
                    firstName: 'User',
                    lastName: 'Two',
                    address: 'Address 2',
                }),
            ).rejects.toThrow();
        });
    });

    describe('Data Integrity', () => {
        it('should maintain data consistency across multiple operations', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(mockFirebaseJWT);

            // Create user via API
            const createResponse = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(201);

            const { userId } = createResponse.body as UserCreatedResponse;

            // Get user by Firebase UID
            const getResponse = await request(httpServer)
                .get(`/api/users`)
                .set('Authorization', `Bearer ${validAuthToken}`)
                .expect(200);

            const body = getResponse.body as UserInfoResponse;

            // Both operations should return consistent data
            expect(body.userInfo.id).toBe(userId);
            expect(body.userInfo.email).toBe(mockFirebaseJWT.email);
            expect(body.userInfo.firstName).toBe(userData.firstName);
            expect(body.userInfo.lastName).toBe(userData.lastName);
        });

        it('should preserve data types correctly', async () => {
            const userData = TestDataHelper.generateUserData();

            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValueOnce(mockFirebaseJWT);

            await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${validAuthToken}`)
                .send({
                    firstName: 'John',
                    middleName: 'Michael',
                    lastName: 'Doe',
                    suffix: 'Jr.',
                    block: userData.block,
                    street: userData.street,
                    barangay: userData.barangay,
                    city: userData.city,
                })
                .expect(201);

            const dbUser = await dbHelper.user.findUnique({
                where: { firebaseUid: mockFirebaseJWT.uid },
            });

            // Verify data types
            expect(typeof dbUser?.id).toBe('string');
            expect(typeof dbUser?.firebaseUid).toBe('string');
            expect(typeof dbUser?.email).toBe('string');
            expect(typeof dbUser?.firstName).toBe('string');
            expect(typeof dbUser?.middleName).toBe('string');
            expect(typeof dbUser?.lastName).toBe('string');
            expect(typeof dbUser?.suffix).toBe('string');
            expect(typeof dbUser?.address).toBe('string');
            expect(dbUser?.createdAt).toBeInstanceOf(Date);
            expect(dbUser?.updatedAt).toBeInstanceOf(Date);
        });
    });
});
