import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';
import { FirebaseService } from '../firebase/firebase.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { type CheckEmailAvailabilityDto } from './dto/check-email-availability.dto';
import { type CreateUserDto } from './dto/create-user.dto';
import { type User } from './interfaces/user.interface';
import { type Prisma } from '../generated/prisma/client';

// Test helper to create mock users
const createMockUser = (overrides: Partial<User> = {}): User =>
    ({
        id: 'user-id-123',
        firebaseUid: 'test-firebase-uid',
        email: 'test@example.com',
        firstName: 'John',
        middleName: null,
        lastName: 'Doe',
        suffix: null,
        address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    }) as User;

const createMockUserCreateArgs = (
    overrides?: Partial<Prisma.UserCreateInput>,
): Prisma.UserCreateInput => ({
    firebaseUid: 'test-firebase-uid',
    email: 'test@example.com',
    firstName: 'John',
    middleName: 'Michael',
    lastName: 'Doe',
    suffix: 'Jr.',
    address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
    ...overrides,
});

describe('UsersService', () => {
    let service: UsersService;

    const mockFirebaseAuth = {
        getUserByEmail: jest.fn(),
    };

    const mockFirebaseService = {
        getAuth: jest.fn(() => mockFirebaseAuth),
    };

    const mockDatabaseService = {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
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
                UsersService,
                {
                    provide: DatabaseService,
                    useValue: mockDatabaseService,
                },
                {
                    provide: FirebaseService,
                    useValue: mockFirebaseService,
                },
                {
                    provide: MyLoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('checkEmailAvailability', () => {
        const testEmail = 'test@example.com';
        const dto: CheckEmailAvailabilityDto = { email: testEmail };

        it('should return available=false if email exists in Firebase', async () => {
            const mockUser = {
                uid: 'test-firebase-uid',
                email: testEmail,
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);

            const result = await service.checkEmailAvailability(dto);

            expect(result).toEqual({
                available: false,
                message: 'Email is already registered',
            });
        });

        it('should return available=true if email not found in Firebase', async () => {
            const firebaseError = new Error('User not found');
            Object.assign(firebaseError, { code: 'auth/user-not-found' });

            mockFirebaseAuth.getUserByEmail.mockRejectedValue(firebaseError);

            const result = await service.checkEmailAvailability(dto);

            expect(result).toEqual({
                available: true,
                message: 'Email is available',
            });
        });

        it('should call Firebase Auth with correct email', async () => {
            const firebaseError = new Error('User not found');
            Object.assign(firebaseError, { code: 'auth/user-not-found' });

            mockFirebaseAuth.getUserByEmail.mockRejectedValue(firebaseError);

            await service.checkEmailAvailability(dto);

            expect(mockFirebaseAuth.getUserByEmail).toHaveBeenCalledWith(testEmail);
        });

        it('should log when email is already registered', async () => {
            const mockUser = {
                uid: 'test-firebase-uid',
                email: testEmail,
            };

            mockFirebaseAuth.getUserByEmail.mockResolvedValue(mockUser);

            await service.checkEmailAvailability(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Email already registered: ${testEmail}`,
                'UsersService',
            );
        });

        it('should log when email is available', async () => {
            const firebaseError = new Error('User not found');
            Object.assign(firebaseError, { code: 'auth/user-not-found' });

            mockFirebaseAuth.getUserByEmail.mockRejectedValue(firebaseError);

            await service.checkEmailAvailability(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Email available: ${testEmail}`,
                'UsersService',
            );
        });

        it('should throw InternalServerErrorException for other errors', async () => {
            const genericError = new Error('Firebase error');
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(genericError);

            await expect(service.checkEmailAvailability(dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.checkEmailAvailability(dto)).rejects.toThrow(
                'Failed to check email availability',
            );
        });

        it('should log error for other errors', async () => {
            const genericError = new Error('Firebase error');
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(genericError);

            await expect(service.checkEmailAvailability(dto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error checking email availability: ${testEmail}`,
                'Firebase error',
                'UsersService',
            );
        });
    });

    describe('create', () => {
        const firebaseUid = 'test-firebase-uid';
        const email = 'test@example.com';
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

        it('should create user successfully', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue({
                id: 'user-id-123',
                firebaseUid,
                email,
                firstName: dto.firstName,
                middleName: dto.middleName,
                lastName: dto.lastName,
                suffix: dto.suffix,
                address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
            });

            const result = await service.create(firebaseUid, email, dto);

            expect(result).toEqual({
                message: 'User registered successfully',
                userId: 'user-id-123',
            });
        });

        it('should check if user already exists', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue(createMockUser());

            await service.create(firebaseUid, email, dto);

            expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
                where: { firebaseUid },
            });
        });

        it('should throw ConflictException if user already exists', async () => {
            const existingUser = createMockUser({ firebaseUid });

            mockDatabaseService.user.findUnique.mockResolvedValue(existingUser);

            await expect(service.create(firebaseUid, email, dto)).rejects.toThrow(
                ConflictException,
            );
            await expect(service.create(firebaseUid, email, dto)).rejects.toThrow(
                'User profile already exists',
            );
        });

        it('should format address correctly', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue(createMockUser());

            await service.create(firebaseUid, email, dto);

            expect(mockDatabaseService.user.create).toHaveBeenCalledWith({
                data: createMockUserCreateArgs({
                    address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
                }),
            });
        });

        it('should trim whitespace from user data', async () => {
            const dtoWithSpaces: CreateUserDto = {
                firstName: '  John  ',
                middleName: '  Michael  ',
                lastName: '  Doe  ',
                suffix: '  Jr.  ',
                block: '  Block 5  ',
                street: '  Sampaguita St  ',
                barangay: '  Brgy Commonwealth  ',
                city: '  Quezon City  ',
            };

            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue(createMockUser());

            await service.create(firebaseUid, email, dtoWithSpaces);

            expect(mockDatabaseService.user.create).toHaveBeenCalledWith({
                data: createMockUserCreateArgs({
                    firstName: 'John',
                    middleName: 'Michael',
                    lastName: 'Doe',
                    suffix: 'Jr.',
                }),
            });
        });

        it('should handle null middleName', async () => {
            const dtoWithoutMiddleName: CreateUserDto = {
                firstName: 'John',
                lastName: 'Doe',
                suffix: 'Jr.',
                block: 'Block 5',
                street: 'Sampaguita St',
                barangay: 'Brgy Commonwealth',
                city: 'Quezon City',
            };

            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue(createMockUser());

            await service.create(firebaseUid, email, dtoWithoutMiddleName);

            expect(mockDatabaseService.user.create).toHaveBeenCalledWith({
                data: createMockUserCreateArgs({
                    middleName: null,
                }),
            });
        });

        it('should handle null suffix', async () => {
            const dtoWithoutSuffix: CreateUserDto = {
                firstName: 'John',
                middleName: 'Michael',
                lastName: 'Doe',
                block: 'Block 5',
                street: 'Sampaguita St',
                barangay: 'Brgy Commonwealth',
                city: 'Quezon City',
            };

            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue(createMockUser());

            await service.create(firebaseUid, email, dtoWithoutSuffix);

            expect(mockDatabaseService.user.create).toHaveBeenCalledWith({
                data: createMockUserCreateArgs({
                    suffix: null,
                }),
            });
        });

        it('should log success message', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue(createMockUser());

            await service.create(firebaseUid, email, dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `User registered successfully: ${email}`,
                'UsersService',
            );
        });

        it('should throw InternalServerErrorException for database errors', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockRejectedValue(new Error('Database error'));

            await expect(service.create(firebaseUid, email, dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.create(firebaseUid, email, dto)).rejects.toThrow(
                'Failed to register user to the database',
            );
        });

        it('should log error for database errors', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockRejectedValue(new Error('Database error'));

            await expect(service.create(firebaseUid, email, dto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error registering user: ${email}`,
                'Database error',
                'UsersService',
            );
        });

        it('should create user with all required fields', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue({
                id: 'user-id-123',
                firebaseUid,
                email,
            });

            await service.create(firebaseUid, email, dto);

            expect(mockDatabaseService.user.create).toHaveBeenCalledWith({
                data: {
                    firebaseUid,
                    email,
                    firstName: 'John',
                    middleName: 'Michael',
                    lastName: 'Doe',
                    suffix: 'Jr.',
                    address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
                },
            });
        });
    });

    describe('findById', () => {
        const userId = 'user-id-123';

        it('should find user by id successfully', async () => {
            const mockUser = createMockUser({
                middleName: 'Michael',
                suffix: 'Jr.',
            });

            mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.findById(userId);

            expect(result.message).toBe('User info fetched successfully');
            expect(result.userInfo.id).toBe(userId);
            expect(result.userInfo.email).toBe('test@example.com');
        });

        it('should parse address into components', async () => {
            const mockUser = createMockUser({
                middleName: 'Michael',
                suffix: 'Jr.',
            });

            mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.findById(userId);

            expect(result.userInfo.block).toBe('Block 5');
            expect(result.userInfo.street).toBe('Sampaguita St');
            expect(result.userInfo.barangay).toBe('Brgy Commonwealth');
            expect(result.userInfo.city).toBe('Quezon City');
        });

        it('should query database with correct id', async () => {
            const mockUser = createMockUser();

            mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

            await service.findById(userId);

            expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
                where: { id: userId },
            });
        });

        it('should throw NotFoundException if user not found', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
            await expect(service.findById(userId)).rejects.toThrow('User not found');
        });

        it('should log success message', async () => {
            const mockUser = createMockUser();

            mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

            await service.findById(userId);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `User info fetched: ${mockUser.email}`,
                'UsersService',
            );
        });

        it('should throw InternalServerErrorException for database errors', async () => {
            mockDatabaseService.user.findUnique.mockRejectedValue(new Error('Database error'));

            await expect(service.findById(userId)).rejects.toThrow(InternalServerErrorException);
            await expect(service.findById(userId)).rejects.toThrow('Failed to fetch user by ID');
        });

        it('should log error for database errors', async () => {
            mockDatabaseService.user.findUnique.mockRejectedValue(new Error('Database error'));

            await expect(service.findById(userId)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching user by ID: ${userId}`,
                'Database error',
                'UsersService',
            );
        });

        it('should handle address with extra spaces', async () => {
            const mockUser = createMockUser({
                address: 'Block 5,  Sampaguita St  , Brgy Commonwealth,  Quezon City  ',
            });

            mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.findById(userId);

            expect(result.userInfo.block).toBe('Block 5');
            expect(result.userInfo.street).toBe('Sampaguita St');
            expect(result.userInfo.barangay).toBe('Brgy Commonwealth');
            expect(result.userInfo.city).toBe('Quezon City');
        });

        it('should handle incomplete address', async () => {
            const mockUser = createMockUser({
                address: 'Block 5',
            });

            mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.findById(userId);

            expect(result.userInfo.block).toBe('Block 5');
            expect(result.userInfo.street).toBe('');
            expect(result.userInfo.barangay).toBe('');
            expect(result.userInfo.city).toBe('');
        });
    });

    describe('findByFirebaseUid', () => {
        const firebaseUid = 'test-firebase-uid';

        it('should find user by Firebase UID successfully', async () => {
            const mockUser = createMockUser({
                middleName: 'Michael',
                suffix: 'Jr.',
            });

            mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.findByFirebaseUid(firebaseUid);

            expect(result.message).toBe('User info fetched successfully');
            expect(result.userInfo.id).toBe('user-id-123');
        });

        it('should query database with Firebase UID', async () => {
            const mockUser = createMockUser();

            mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

            await service.findByFirebaseUid(firebaseUid);

            expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
                where: { firebaseUid },
            });
        });

        it('should parse address into components', async () => {
            const mockUser = createMockUser();

            mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.findByFirebaseUid(firebaseUid);

            expect(result.userInfo.block).toBe('Block 5');
            expect(result.userInfo.street).toBe('Sampaguita St');
            expect(result.userInfo.barangay).toBe('Brgy Commonwealth');
            expect(result.userInfo.city).toBe('Quezon City');
        });

        it('should throw NotFoundException if user not found', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await expect(service.findByFirebaseUid(firebaseUid)).rejects.toThrow(NotFoundException);
            await expect(service.findByFirebaseUid(firebaseUid)).rejects.toThrow(
                'User profile not found in database',
            );
        });

        it('should log success message', async () => {
            const mockUser = createMockUser();

            mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

            await service.findByFirebaseUid(firebaseUid);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `User info fetched by Firebase UID: ${mockUser.email}`,
                'UsersService',
            );
        });

        it('should throw InternalServerErrorException for database errors', async () => {
            mockDatabaseService.user.findUnique.mockRejectedValue(new Error('Database error'));

            await expect(service.findByFirebaseUid(firebaseUid)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.findByFirebaseUid(firebaseUid)).rejects.toThrow(
                'Failed to fetch user by Firebase UID',
            );
        });

        it('should log error for database errors', async () => {
            mockDatabaseService.user.findUnique.mockRejectedValue(new Error('Database error'));

            await expect(service.findByFirebaseUid(firebaseUid)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching user by Firebase UID: ${firebaseUid}`,
                'Database error',
                'UsersService',
            );
        });
    });

    describe('address handling', () => {
        it('should format address with comma separation', async () => {
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

            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue(createMockUser());

            await service.create('test-firebase-uid', 'test@example.com', dto);

            expect(mockDatabaseService.user.create).toHaveBeenCalledWith({
                data: createMockUserCreateArgs({
                    address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
                }),
            });
        });

        it('should parse address correctly on retrieval', async () => {
            const mockUser = createMockUser({
                address: 'Block 10, Main St, Brgy Test, Manila City',
            });

            mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.findById('user-id-123');

            expect(result.userInfo.address).toBe('Block 10, Main St, Brgy Test, Manila City');
            expect(result.userInfo.block).toBe('Block 10');
            expect(result.userInfo.street).toBe('Main St');
            expect(result.userInfo.barangay).toBe('Brgy Test');
            expect(result.userInfo.city).toBe('Manila City');
        });
    });
});
