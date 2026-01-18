import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from '../../../src/users/users.service';
import { DatabaseService } from '../../../src/database/database.service';
import { FirebaseService } from '../../../src/firebase/firebase.service';
import { MyLoggerService } from '../../../src/my-logger/my-logger.service';
import { TestDatabaseHelper, TestDataHelper } from '../../helpers';
import { createMockFirebaseService, FirebaseAuthErrors } from '../../mocks/firebase.mock';
import { envValidationSchema } from '../../../src/config/env.validation';
import type { CreateUserDto } from '../../../src/users/dto/create-user.dto';

describe('UsersService Integration Tests', () => {
    let app: INestApplication;
    let usersService: UsersService;
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
                UsersService,
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

        usersService = moduleFixture.get<UsersService>(UsersService);
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

    describe('checkEmailAvailability', () => {
        it('should return available=false when email exists in Firebase', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Mock Firebase user exists
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValue({
                uid: TestDataHelper.generateFirebaseUid(),
                email,
            });

            const result = await usersService.checkEmailAvailability({ email });

            expect(result).toEqual({
                available: false,
                message: 'Email is already registered',
            });
            expect(mockFirebaseService.getAuth().getUserByEmail).toHaveBeenCalledWith(email);
        });

        it('should return available=true when email not found in Firebase', async () => {
            const email = TestDataHelper.generateRandomEmail();

            // Mock Firebase user not found error
            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            const result = await usersService.checkEmailAvailability({ email });

            expect(result).toEqual({
                available: true,
                message: 'Email is available',
            });
        });

        it('should check multiple emails in sequence', async () => {
            const email1 = TestDataHelper.generateRandomEmail();
            const email2 = TestDataHelper.generateRandomEmail();

            // Email1 exists in Firebase
            mockFirebaseService.getAuth().getUserByEmail.mockResolvedValueOnce({
                uid: TestDataHelper.generateFirebaseUid(),
                email: email1,
            });

            // Email2 does not exist
            mockFirebaseService
                .getAuth()
                .getUserByEmail.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());

            const result1 = await usersService.checkEmailAvailability({ email: email1 });
            const result2 = await usersService.checkEmailAvailability({ email: email2 });

            expect(result1.available).toBe(false);
            expect(result2.available).toBe(true);
        });

        it('should handle concurrent email availability checks', async () => {
            const emails = Array.from({ length: 5 }, () => TestDataHelper.generateRandomEmail());

            // Mock all emails as not found
            emails.forEach(() => {
                mockFirebaseService
                    .getAuth()
                    .getUserByEmail.mockRejectedValueOnce(FirebaseAuthErrors.userNotFound());
            });

            const results = await Promise.all(
                emails.map((email) => usersService.checkEmailAvailability({ email })),
            );

            results.forEach((result) => {
                expect(result.available).toBe(true);
            });
        });
    });

    describe('create', () => {
        it('should create user successfully in database', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            const dto: CreateUserDto = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            const result = await usersService.create(firebaseUid, email, dto);

            expect(result).toHaveProperty('message', 'User registered successfully');
            expect(result).toHaveProperty('userId');

            // Verify user was actually created in database
            const dbUser = await databaseService.user.findUnique({
                where: { firebaseUid },
            });

            expect(dbUser).not.toBeNull();
            expect(dbUser?.email).toBe(email);
            expect(dbUser?.firstName).toBe(userData.firstName);
            expect(dbUser?.lastName).toBe(userData.lastName);
        });

        it('should format address correctly when creating user', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            const dto: CreateUserDto = {
                firstName: 'John',
                lastName: 'Doe',
                block: 'Block 5',
                street: 'Sampaguita St',
                barangay: 'Brgy Commonwealth',
                city: 'Quezon City',
            };

            await usersService.create(firebaseUid, email, dto);

            const dbUser = await databaseService.user.findUnique({
                where: { firebaseUid },
            });

            expect(dbUser?.address).toBe('Block 5, Sampaguita St, Brgy Commonwealth, Quezon City');
        });

        it('should trim whitespace from user data', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

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

            await usersService.create(firebaseUid, email, dto);

            const dbUser = await databaseService.user.findUnique({
                where: { firebaseUid },
            });

            expect(dbUser?.firstName).toBe('John');
            expect(dbUser?.middleName).toBe('Michael');
            expect(dbUser?.lastName).toBe('Doe');
            expect(dbUser?.suffix).toBe('Jr.');
            expect(dbUser?.address).toBe('Block 5, Sampaguita St, Brgy Commonwealth, Quezon City');
        });

        it('should handle null middleName and suffix', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            const dto: CreateUserDto = {
                firstName: 'John',
                lastName: 'Doe',
                block: 'Block 5',
                street: 'Sampaguita St',
                barangay: 'Brgy Commonwealth',
                city: 'Quezon City',
            };

            await usersService.create(firebaseUid, email, dto);

            const dbUser = await databaseService.user.findUnique({
                where: { firebaseUid },
            });

            expect(dbUser?.middleName).toBeNull();
            expect(dbUser?.suffix).toBeNull();
        });

        it('should throw ConflictException if user already exists', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            const dto: CreateUserDto = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            // Create user first time
            await usersService.create(firebaseUid, email, dto);

            // Try to create same user again
            await expect(usersService.create(firebaseUid, email, dto)).rejects.toThrow(
                ConflictException,
            );
            await expect(usersService.create(firebaseUid, email, dto)).rejects.toThrow(
                'User profile already exists',
            );
        });

        it('should create multiple users successfully', async () => {
            const users = Array.from({ length: 5 }, () => ({
                email: TestDataHelper.generateRandomEmail(),
                firebaseUid: TestDataHelper.generateFirebaseUid(),
                userData: TestDataHelper.generateUserData(),
            }));

            for (const user of users) {
                const dto: CreateUserDto = {
                    firstName: user.userData.firstName,
                    lastName: user.userData.lastName,
                    block: user.userData.block,
                    street: user.userData.street,
                    barangay: user.userData.barangay,
                    city: user.userData.city,
                };

                await usersService.create(user.firebaseUid, user.email, dto);
            }

            // Verify all users were created
            const allUsers = await databaseService.user.findMany();
            expect(allUsers.length).toBe(5);
        });

        it('should generate unique CUIDs for each user', async () => {
            const users = Array.from({ length: 3 }, () => ({
                email: TestDataHelper.generateRandomEmail(),
                firebaseUid: TestDataHelper.generateFirebaseUid(),
                userData: TestDataHelper.generateUserData(),
            }));

            const userIds: string[] = [];

            for (const user of users) {
                const dto: CreateUserDto = {
                    firstName: user.userData.firstName,
                    lastName: user.userData.lastName,
                    block: user.userData.block,
                    street: user.userData.street,
                    barangay: user.userData.barangay,
                    city: user.userData.city,
                };

                const result = await usersService.create(user.firebaseUid, user.email, dto);
                userIds.push(result.userId);
            }

            // All IDs should be unique
            const uniqueIds = new Set(userIds);
            expect(uniqueIds.size).toBe(3);
        });

        it('should set createdAt and updatedAt timestamps', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            const dto: CreateUserDto = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            const beforeCreate = new Date();
            await usersService.create(firebaseUid, email, dto);
            const afterCreate = new Date();

            const dbUser = await databaseService.user.findUnique({
                where: { firebaseUid },
            });

            expect(dbUser?.createdAt).toBeDefined();
            expect(dbUser?.updatedAt).toBeDefined();
            expect(dbUser?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
            expect(dbUser?.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
        });
    });

    describe('findById', () => {
        it('should find user by database ID', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            // Create user
            const dto: CreateUserDto = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            const { userId } = await usersService.create(firebaseUid, email, dto);

            // Find user by ID
            const result = await usersService.findById(userId);

            expect(result.message).toBe('User info fetched successfully');
            expect(result.userInfo.id).toBe(userId);
            expect(result.userInfo.email).toBe(email);
            expect(result.userInfo.firstName).toBe(userData.firstName);
        });

        it('should parse address into components', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            const dto: CreateUserDto = {
                firstName: 'John',
                lastName: 'Doe',
                block: 'Block 5',
                street: 'Sampaguita St',
                barangay: 'Brgy Commonwealth',
                city: 'Quezon City',
            };

            const { userId } = await usersService.create(firebaseUid, email, dto);
            const result = await usersService.findById(userId);

            expect(result.userInfo.address).toBe(
                'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
            );
            expect(result.userInfo.block).toBe('Block 5');
            expect(result.userInfo.street).toBe('Sampaguita St');
            expect(result.userInfo.barangay).toBe('Brgy Commonwealth');
            expect(result.userInfo.city).toBe('Quezon City');
        });

        it('should throw NotFoundException when user does not exist', async () => {
            const nonExistentId = TestDataHelper.generateCuid();

            await expect(usersService.findById(nonExistentId)).rejects.toThrow(NotFoundException);
            await expect(usersService.findById(nonExistentId)).rejects.toThrow('User not found');
        });

        it('should handle address with extra spaces', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Create user directly in database with extra spaces
            const createdUser = await databaseService.user.create({
                data: {
                    firebaseUid,
                    email,
                    firstName: 'John',
                    lastName: 'Doe',
                    address: 'Block 5,  Sampaguita St  , Brgy Commonwealth,  Quezon City  ',
                },
            });

            const result = await usersService.findById(createdUser.id);

            expect(result.userInfo.block).toBe('Block 5');
            expect(result.userInfo.street).toBe('Sampaguita St');
            expect(result.userInfo.barangay).toBe('Brgy Commonwealth');
            expect(result.userInfo.city).toBe('Quezon City');
        });

        it('should handle incomplete address', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Create user with minimal address
            const createdUser = await databaseService.user.create({
                data: {
                    firebaseUid,
                    email,
                    firstName: 'John',
                    lastName: 'Doe',
                    address: 'Block 5',
                },
            });

            const result = await usersService.findById(createdUser.id);

            expect(result.userInfo.block).toBe('Block 5');
            expect(result.userInfo.street).toBe('');
            expect(result.userInfo.barangay).toBe('');
            expect(result.userInfo.city).toBe('');
        });
    });

    describe('findByFirebaseUid', () => {
        it('should find user by Firebase UID', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            const dto: CreateUserDto = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            await usersService.create(firebaseUid, email, dto);

            const result = await usersService.findByFirebaseUid(firebaseUid);

            expect(result.message).toBe('User info fetched successfully');
            expect(result.userInfo.email).toBe(email);
            expect(result.userInfo.firstName).toBe(userData.firstName);
        });

        it('should parse address into components', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            const dto: CreateUserDto = {
                firstName: 'John',
                lastName: 'Doe',
                block: 'Block 10',
                street: 'Main St',
                barangay: 'Brgy Test',
                city: 'Manila City',
            };

            await usersService.create(firebaseUid, email, dto);
            const result = await usersService.findByFirebaseUid(firebaseUid);

            expect(result.userInfo.block).toBe('Block 10');
            expect(result.userInfo.street).toBe('Main St');
            expect(result.userInfo.barangay).toBe('Brgy Test');
            expect(result.userInfo.city).toBe('Manila City');
        });

        it('should throw NotFoundException when Firebase UID not found', async () => {
            const nonExistentUid = TestDataHelper.generateFirebaseUid();

            await expect(usersService.findByFirebaseUid(nonExistentUid)).rejects.toThrow(
                NotFoundException,
            );
            await expect(usersService.findByFirebaseUid(nonExistentUid)).rejects.toThrow(
                'User profile not found in database',
            );
        });

        it('should find different users by their Firebase UIDs', async () => {
            const users = Array.from({ length: 3 }, () => ({
                email: TestDataHelper.generateRandomEmail(),
                firebaseUid: TestDataHelper.generateFirebaseUid(),
                userData: TestDataHelper.generateUserData(),
            }));

            // Create all users
            for (const user of users) {
                const dto: CreateUserDto = {
                    firstName: user.userData.firstName,
                    lastName: user.userData.lastName,
                    block: user.userData.block,
                    street: user.userData.street,
                    barangay: user.userData.barangay,
                    city: user.userData.city,
                };

                await usersService.create(user.firebaseUid, user.email, dto);
            }

            // Find each user by their Firebase UID
            for (const user of users) {
                const result = await usersService.findByFirebaseUid(user.firebaseUid);
                expect(result.userInfo.email).toBe(user.email);
            }
        });
    });

    describe('database constraints and relationships', () => {
        it('should enforce unique Firebase UID constraint', async () => {
            const email1 = TestDataHelper.generateRandomEmail();
            const email2 = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid(); // Same UID
            const userData = TestDataHelper.generateUserData();

            const dto: CreateUserDto = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            // Create first user
            await usersService.create(firebaseUid, email1, dto);

            // Try to create second user with same Firebase UID
            await expect(usersService.create(firebaseUid, email2, dto)).rejects.toThrow();
        });

        it('should enforce unique email constraint', async () => {
            const email = TestDataHelper.generateRandomEmail(); // Same email
            const firebaseUid1 = TestDataHelper.generateFirebaseUid();
            const firebaseUid2 = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            const dto: CreateUserDto = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            // Create first user
            await usersService.create(firebaseUid1, email, dto);

            // Try to create second user with same email
            await expect(usersService.create(firebaseUid2, email, dto)).rejects.toThrow();
        });

        it('should automatically set timestamps on creation', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            const dto: CreateUserDto = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            const { userId } = await usersService.create(firebaseUid, email, dto);
            const dbUser = await databaseService.user.findUnique({
                where: { id: userId },
            });

            expect(dbUser?.createdAt).toBeInstanceOf(Date);
            expect(dbUser?.updatedAt).toBeInstanceOf(Date);
            expect(dbUser?.createdAt.getTime()).toBeLessThanOrEqual(dbUser!.updatedAt.getTime());
        });

        it('should handle database transaction rollback on error', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            // Try to create user with invalid data (very long firstName to trigger error)
            const invalidDto: CreateUserDto = {
                firstName: 'A'.repeat(200), // Exceeds max length
                lastName: 'Doe',
                block: 'Block 5',
                street: 'Sampaguita St',
                barangay: 'Brgy Commonwealth',
                city: 'Quezon City',
            };

            await expect(usersService.create(firebaseUid, email, invalidDto)).rejects.toThrow();

            // Verify user was not created
            const dbUser = await databaseService.user.findUnique({
                where: { firebaseUid },
            });
            expect(dbUser).toBeNull();
        });
    });

    describe('data integrity', () => {
        it('should maintain data consistency across multiple operations', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();
            const userData = TestDataHelper.generateUserData();

            const dto: CreateUserDto = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                block: userData.block,
                street: userData.street,
                barangay: userData.barangay,
                city: userData.city,
            };

            // Create user
            const { userId } = await usersService.create(firebaseUid, email, dto);

            // Find by ID
            const resultById = await usersService.findById(userId);

            // Find by Firebase UID
            const resultByFirebaseUid = await usersService.findByFirebaseUid(firebaseUid);

            // Both queries should return same data
            expect(resultById.userInfo.email).toBe(resultByFirebaseUid.userInfo.email);
            expect(resultById.userInfo.firstName).toBe(resultByFirebaseUid.userInfo.firstName);
            expect(resultById.userInfo.address).toBe(resultByFirebaseUid.userInfo.address);
        });

        it('should handle concurrent user creation for different users', async () => {
            const users = Array.from({ length: 5 }, () => ({
                email: TestDataHelper.generateRandomEmail(),
                firebaseUid: TestDataHelper.generateFirebaseUid(),
                userData: TestDataHelper.generateUserData(),
            }));

            const promises = users.map((user) => {
                const dto: CreateUserDto = {
                    firstName: user.userData.firstName,
                    lastName: user.userData.lastName,
                    block: user.userData.block,
                    street: user.userData.street,
                    barangay: user.userData.barangay,
                    city: user.userData.city,
                };

                return usersService.create(user.firebaseUid, user.email, dto);
            });

            const results = await Promise.all(promises);

            // All users should be created successfully
            expect(results).toHaveLength(5);
            results.forEach((result) => {
                expect(result).toHaveProperty('userId');
                expect(result.message).toBe('User registered successfully');
            });

            // Verify all users exist in database
            const allUsers = await databaseService.user.findMany();
            expect(allUsers).toHaveLength(5);
        });

        it('should preserve data types correctly', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            const dto: CreateUserDto = {
                firstName: 'John',
                middleName: 'Michael',
                lastName: 'Doe',
                suffix: 'Jr.',
                block: 'Block 5',
                street: 'Sampaguita St',
                barangay: 'Brgy Commonwealth',
                city: 'Quezon City',
            };

            const { userId } = await usersService.create(firebaseUid, email, dto);
            const dbUser = await databaseService.user.findUnique({
                where: { id: userId },
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

    describe('edge cases', () => {
        it('should handle user with very long names', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            const dto: CreateUserDto = {
                firstName: 'A'.repeat(100), // Max length allowed by DTO
                lastName: 'B'.repeat(100),
                block: 'Block 999',
                street: 'Very Long Street Name That Goes On Forever',
                barangay: 'Barangay With A Very Long Name',
                city: 'City With Long Name',
            };

            const { userId } = await usersService.create(firebaseUid, email, dto);
            const result = await usersService.findById(userId);

            expect(result.userInfo.firstName).toBe('A'.repeat(100));
            expect(result.userInfo.lastName).toBe('B'.repeat(100));
        });

        it('should handle special characters in names', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            const dto: CreateUserDto = {
                firstName: "O'Brien",
                lastName: 'García-López',
                suffix: 'III',
                block: 'Block 5-A',
                street: "St. Mary's Street",
                barangay: 'Brgy. San José',
                city: 'Quezon City',
            };

            const { userId } = await usersService.create(firebaseUid, email, dto);
            const result = await usersService.findById(userId);

            expect(result.userInfo.firstName).toBe("O'Brien");
            expect(result.userInfo.lastName).toBe('García-López');
        });

        it('should handle empty address components gracefully', async () => {
            const email = TestDataHelper.generateRandomEmail();
            const firebaseUid = TestDataHelper.generateFirebaseUid();

            const dto: CreateUserDto = {
                firstName: 'John',
                lastName: 'Doe',
                block: '',
                street: '',
                barangay: '',
                city: 'Manila',
            };

            const { userId } = await usersService.create(firebaseUid, email, dto);
            const result = await usersService.findById(userId);

            // Should only have city since other parts are empty
            expect(result.userInfo.address).toBe('Manila');
        });
    });
});
