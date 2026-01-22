import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestDatabaseHelper, TestDataHelper, TestServerHelper } from '../helpers';
import { type Server } from 'http';
import {
    type UserCreatedResponse,
    type EmailAvailabilityResponse,
    type UserInfo,
} from '../../src/users/interfaces/user.interface';
import * as crypto from 'crypto';
import { FirebaseService } from '../../src/firebase/firebase.service';
import { type FirebaseTokenPayload } from '../../src/common/interfaces';

jest.mock('crypto', () => {
    const actualCrypto = jest.requireActual<typeof crypto>('crypto');

    return {
        ...actualCrypto,
        randomInt: jest.fn(),
    };
});

/**
 * User Registration Flow E2E Tests
 *
 * These tests use REAL services (Firebase, SendGrid) and REAL test database.
 * Only critical registration flows are tested here.
 *
 * Prerequisites:
 * - Firebase project must be configured
 * - SendGrid API key must be valid (will send real OTP emails)
 * - Test database must be accessible
 *
 * Note: OTP emails will be sent to real email addresses during these tests but OTP will be overriden.
 */
describe('E2E User Registration Flow', () => {
    let app: INestApplication;
    let dbHelper: TestDatabaseHelper;
    let serverHelper: TestServerHelper;
    let httpServer: Server;

    beforeAll(async () => {
        // Initialize database helper with hosted PostgreSQL test DB
        dbHelper = new TestDatabaseHelper();
        await dbHelper.connect();

        // Create NestJS testing module with real external services
        serverHelper = new TestServerHelper();
        app = await serverHelper.createTestApp();
        httpServer = app.getHttpServer() as Server;
    });

    afterAll(async () => {
        await dbHelper.clearDatabase();
        await dbHelper.disconnect();
        await serverHelper.closeApp();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Traditional Sign-up Subflow', () => {
        const email = TestDataHelper.generateRandomEmail();
        const userData = TestDataHelper.generateUserData();
        let firebaseUser: FirebaseTokenPayload;
        let user: Partial<UserInfo>;

        afterAll(async () => {
            await app.get(FirebaseService).getAuth().deleteUser(user.firebaseUid!);
            await dbHelper.clearDatabase();
        });

        it('should check email availability for registration', async () => {
            const response = await request(httpServer)
                .get('/api/users')
                .query({ email })
                .expect(200);

            const body = response.body as EmailAvailabilityResponse;

            expect(body).toHaveProperty('available');
            expect(body).toHaveProperty('message');
            expect(typeof body.available).toBe('boolean');

            // Email should be available
            expect(body.available).toBe(true);
            expect(body.message).toBe('Email is available');
        });

        it('should send email verification OTP to valid email for registration', async () => {
            (crypto.randomInt as jest.Mock).mockReturnValue(1);

            const response = await request(httpServer)
                .post('/api/auth/otp/registration')
                .send({ email })
                .expect(200);

            expect(response.body).toEqual({
                message: 'Registration OTP sent successfully. Please check your email.',
            });
        });

        it('should verify sent OTP for registration', async () => {
            const code = '11111';

            const response = await request(httpServer)
                .post('/api/auth/otp/verify')
                .send({
                    email,
                    code,
                    purpose: 'registration',
                })
                .expect(200);

            expect(response.body).toEqual({
                message: 'OTP verified successfully.',
            });
        });

        it('should register user in Firebase Auth', async () => {
            const password = TestDataHelper.generateStrongPassword();

            // Create user in Firebase
            const userRecord = await app.get(FirebaseService).getAuth().createUser({
                email,
                password,
                emailVerified: true,
            });

            firebaseUser = {
                firebaseUid: userRecord.uid,
                email: userRecord.email!,
            };

            expect(firebaseUser.firebaseUid).toBeTruthy();
            expect(firebaseUser.email).toBe(email);
        });

        it('should register user in the database', async () => {
            const mockDecodedToken = TestDataHelper.createMockDecodedToken({
                uid: firebaseUser.firebaseUid,
                email: firebaseUser.email,
            });

            jest.spyOn(app.get(FirebaseService).getAuth(), 'verifyIdToken').mockResolvedValueOnce(
                mockDecodedToken,
            );

            const response = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${firebaseUser.firebaseUid}`)
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
                where: { firebaseUid: firebaseUser.firebaseUid },
            });

            user = {
                id: dbUser?.id,
                firebaseUid: firebaseUser.firebaseUid,
                email: firebaseUser.email,
                firstName: dbUser?.firstName,
                middleName: dbUser?.middleName,
                lastName: dbUser?.lastName,
                suffix: dbUser?.suffix,
                address: dbUser?.address,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            expect(dbUser).not.toBeNull();
            expect(dbUser?.email).toBe(firebaseUser.email);
            expect(dbUser?.firstName).toBe(userData.firstName);
            expect(dbUser?.lastName).toBe(userData.lastName);
        });

        it('should retrieve user info from the database', async () => {
            const mockDecodedToken = TestDataHelper.createMockDecodedToken({
                uid: firebaseUser.firebaseUid,
                email: firebaseUser.email,
            });

            jest.spyOn(app.get(FirebaseService).getAuth(), 'verifyIdToken').mockResolvedValueOnce(
                mockDecodedToken,
            );

            const response = await request(httpServer)
                .get(`/api/users/${firebaseUser.firebaseUid}`)
                .set('Authorization', `Bearer ${firebaseUser.firebaseUid}`)
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'User info fetched successfully',
                userInfo: {
                    id: user.id,
                    firebaseUid: user.firebaseUid,
                    email: user.email,
                    firstName: user.firstName,
                    middleName: user.middleName,
                    lastName: user.lastName,
                    suffix: user.suffix,
                    address: user.address,
                    block: user.block,
                    street: user.street,
                    barangay: user.barangay,
                    city: user.city,
                },
            });

            // Verify user exists in database
            const dbUser = await dbHelper.user.findUnique({
                where: { firebaseUid: user.firebaseUid },
            });

            expect(dbUser).not.toBeNull();
            expect(dbUser?.email).toBe(user.email);
            expect(dbUser?.firstName).toBe(user.firstName);
            expect(dbUser?.lastName).toBe(user.lastName);
        });

        describe('forgot Password Endpoints', () => {
            it('should check if account exists for password reset', async () => {
                const response = await request(httpServer)
                    .get('/api/users')
                    .query({ email })
                    .expect(200);

                const body = response.body as EmailAvailabilityResponse;

                expect(body).toHaveProperty('available');
                expect(body).toHaveProperty('message');
                expect(typeof body.available).toBe('boolean');

                // Email should not be available now
                expect(body.available).toBe(false);
                expect(body.message).toBe('Email is already registered');
            });

            it('should only return password as provider', async () => {
                const response = await request(httpServer)
                    .get('/api/auth/providers')
                    .query({ email })
                    .expect(200);

                expect(response.body).toEqual({
                    providers: ['password'],
                });
            });

            it('should send forgot password OTP to valid email for password reset', async () => {
                (crypto.randomInt as jest.Mock).mockReturnValue(1);

                const response = await request(httpServer)
                    .post('/api/auth/otp/forgot-password')
                    .send({ email })
                    .expect(200);

                expect(response.body).toEqual({
                    message: 'Password reset OTP sent successfully. Please check your email.',
                });
            });

            it('should verify sent OTP for password reset', async () => {
                const code = '11111';

                const response = await request(httpServer)
                    .post('/api/auth/otp/verify')
                    .send({
                        email,
                        code,
                        purpose: 'forgot-password',
                    })
                    .expect(200);

                expect(response.body).toEqual({
                    message: 'OTP verified successfully.',
                });
            });
        });
    });

    describe('Google SSO Subflow', () => {
        const email = 'butikaimnida@gmail.com';
        const userData = TestDataHelper.generateUserData();
        let firebaseUser: FirebaseTokenPayload;
        let user: Partial<UserInfo>;

        it('should check email availability for registration', async () => {
            const response = await request(httpServer)
                .get('/api/users')
                .query({ email })
                .expect(200);

            const body = response.body as EmailAvailabilityResponse;

            expect(body).toHaveProperty('available');
            expect(body).toHaveProperty('message');
            expect(typeof body.available).toBe('boolean');

            // Email should not be available since we are
            // using a test account that uses Google SSO.
            expect(body.available).toBe(false);
            expect(body.message).toBe('Email is already registered');
        });

        it('should check onboarding status and be true', async () => {
            const response = await request(httpServer)
                .get('/api/auth/onboarding-status')
                .query({ email })
                .expect(200);

            expect(response.body).toEqual({
                needsOnboarding: true,
                providers: ['google.com'],
                message: 'User exists in Firebase, but no profile found in database',
            });
        });

        it('should retrieve user in Firebase Auth', async () => {
            // Retrieve user in Firebase
            const userRecord = await app.get(FirebaseService).getAuth().getUserByEmail(email);

            firebaseUser = {
                firebaseUid: userRecord.uid,
                email: userRecord.email!,
            };

            expect(firebaseUser.firebaseUid).toBeTruthy();
            expect(firebaseUser.email).toBe(email);
        });

        it('should register user in the database', async () => {
            const mockDecodedToken = TestDataHelper.createMockDecodedToken({
                uid: firebaseUser.firebaseUid,
                email: firebaseUser.email,
            });

            jest.spyOn(app.get(FirebaseService).getAuth(), 'verifyIdToken').mockResolvedValueOnce(
                mockDecodedToken,
            );

            const response = await request(httpServer)
                .post('/api/users')
                .set('Authorization', `Bearer ${firebaseUser.firebaseUid}`)
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
                where: { firebaseUid: firebaseUser.firebaseUid },
            });

            user = {
                id: dbUser?.id,
                firebaseUid: firebaseUser.firebaseUid,
                email: firebaseUser.email,
                firstName: dbUser?.firstName,
                middleName: dbUser?.middleName,
                lastName: dbUser?.lastName,
                suffix: dbUser?.suffix,
                address: dbUser?.address,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            expect(dbUser).not.toBeNull();
            expect(dbUser?.email).toBe(firebaseUser.email);
            expect(dbUser?.firstName).toBe(userData.firstName);
            expect(dbUser?.lastName).toBe(userData.lastName);
        });

        it('should retrieve user info from the database', async () => {
            const mockDecodedToken = TestDataHelper.createMockDecodedToken({
                uid: firebaseUser.firebaseUid,
                email: firebaseUser.email,
            });

            jest.spyOn(app.get(FirebaseService).getAuth(), 'verifyIdToken').mockResolvedValueOnce(
                mockDecodedToken,
            );

            const response = await request(httpServer)
                .get(`/api/users/${firebaseUser.firebaseUid}`)
                .set('Authorization', `Bearer ${firebaseUser.firebaseUid}`)
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'User info fetched successfully',
                userInfo: {
                    id: user.id,
                    firebaseUid: user.firebaseUid,
                    email: user.email,
                    firstName: user.firstName,
                    middleName: user.middleName,
                    lastName: user.lastName,
                    suffix: user.suffix,
                    address: user.address,
                    block: user.block,
                    street: user.street,
                    barangay: user.barangay,
                    city: user.city,
                },
            });

            // Verify user exists in database
            const dbUser = await dbHelper.user.findUnique({
                where: { firebaseUid: user.firebaseUid },
            });

            expect(dbUser).not.toBeNull();
            expect(dbUser?.email).toBe(user.email);
            expect(dbUser?.firstName).toBe(user.firstName);
            expect(dbUser?.lastName).toBe(user.lastName);
        });

        describe('forgot Password Endpoints', () => {
            it('should check if account exists for password reset', async () => {
                const response = await request(httpServer)
                    .get('/api/users')
                    .query({ email })
                    .expect(200);

                const body = response.body as EmailAvailabilityResponse;

                expect(body).toHaveProperty('available');
                expect(body).toHaveProperty('message');
                expect(typeof body.available).toBe('boolean');

                // Email should not be available now
                expect(body.available).toBe(false);
                expect(body.message).toBe('Email is already registered');
            });

            it('should only return google.com as provider', async () => {
                const response = await request(httpServer)
                    .get('/api/auth/providers')
                    .query({ email })
                    .expect(200);

                // User won't be able to reset password in app
                // since the email is associated with a Google account.
                expect(response.body).toEqual({
                    providers: ['google.com'],
                });
            });
        });
    });
});
