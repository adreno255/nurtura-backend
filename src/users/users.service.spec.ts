import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';
import { FirebaseService } from '../firebase/firebase.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { EmailService } from '../email/email.service';
import { type CheckEmailAvailabilityDto } from './dto/check-email-availability.dto';
import { type CreateUserDto } from './dto/create-user.dto';
import { type UpdateUserDto } from './dto/update-user.dto';
import { type User } from './interfaces/user.interface';
import { type Prisma } from '../generated/prisma/client';
import {
    inputUser,
    testEmails,
    testFirebaseUids,
    validCreateUserDto,
    validEmailQueryDto,
    validUser,
    validUpdateUserDto,
} from '../../test/fixtures';
import {
    createMockDatabaseService,
    createMockFirebaseAuth,
    createMockFirebaseService,
    createMockLogger,
    createMockEmailService,
    FirebaseAuthErrors,
} from '../../test/mocks';

// Test helper to create mock users
const createMockUser = (overrides: Partial<User> = {}): User => ({
    ...validUser,
    ...overrides,
});

const createMockUserCreateArgs = (
    overrides?: Partial<Prisma.UserCreateInput>,
): Prisma.UserCreateInput => ({
    ...inputUser,
    ...overrides,
});

describe('UsersService', () => {
    let service: UsersService;

    const mockFirebaseAuth = createMockFirebaseAuth();

    const mockFirebaseService = createMockFirebaseService(mockFirebaseAuth);

    const mockDatabaseService = createMockDatabaseService();

    const mockLoggerService = createMockLogger();

    const mockEmailService = createMockEmailService();

    const testEmail = testEmails.valid;
    const testFirebaseUid = testFirebaseUids.primary;
    const checkEmailAvailabilityDto = validEmailQueryDto;
    const createUserDto = validCreateUserDto;

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
                {
                    provide: EmailService,
                    useValue: mockEmailService,
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
        const dto: CheckEmailAvailabilityDto = checkEmailAvailabilityDto;

        it('should return available=false if email exists in Firebase', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(validUser);

            const result = await service.checkEmailAvailability(dto);

            expect(result).toEqual({
                available: false,
                message: 'Email is already registered',
            });
        });

        it('should return available=true if email not found in Firebase', async () => {
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            const result = await service.checkEmailAvailability(dto);

            expect(result).toEqual({
                available: true,
                message: 'Email is available',
            });
        });

        it('should call Firebase Auth with correct email', async () => {
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

            await service.checkEmailAvailability(dto);

            expect(mockFirebaseAuth.getUserByEmail).toHaveBeenCalledWith(testEmail);
        });

        it('should log when email is already registered', async () => {
            mockFirebaseAuth.getUserByEmail.mockResolvedValue(validUser);

            await service.checkEmailAvailability(dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `Email already registered: ${testEmail}`,
                'UsersService',
            );
        });

        it('should log when email is available', async () => {
            mockFirebaseAuth.getUserByEmail.mockRejectedValue(FirebaseAuthErrors.userNotFound());

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
        const dto: CreateUserDto = createUserDto;

        it('should create user successfully', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue({
                id: 'user-id-123',
                testFirebaseUid,
                testEmail,
                firstName: dto.firstName,
                middleName: dto.middleName,
                lastName: dto.lastName,
                suffix: dto.suffix,
                address: 'Block 5, Sampaguita St, Brgy Commonwealth, Quezon City',
            });

            const result = await service.create(testFirebaseUid, testEmail, dto);

            expect(result).toEqual({
                message: 'User registered successfully',
                userId: 'user-id-123',
            });
        });

        it('should check if user already exists', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue(createMockUser());

            await service.create(testFirebaseUid, testEmail, dto);

            expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
                where: { firebaseUid: testFirebaseUid },
            });
        });

        it('should throw ConflictException if user already exists', async () => {
            const existingUser = createMockUser({ firebaseUid: testFirebaseUid });

            mockDatabaseService.user.findUnique.mockResolvedValue(existingUser);

            await expect(service.create(testFirebaseUid, testEmail, dto)).rejects.toThrow(
                ConflictException,
            );
            await expect(service.create(testFirebaseUid, testEmail, dto)).rejects.toThrow(
                'User profile already exists',
            );
        });

        it('should format address correctly', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue(createMockUser());

            await service.create(testFirebaseUid, testEmail, dto);

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

            await service.create(testFirebaseUid, testEmail, dtoWithSpaces);

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

            await service.create(testFirebaseUid, testEmail, dtoWithoutMiddleName);

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

            await service.create(testFirebaseUid, testEmail, dtoWithoutSuffix);

            expect(mockDatabaseService.user.create).toHaveBeenCalledWith({
                data: createMockUserCreateArgs({
                    suffix: null,
                }),
            });
        });

        it('should log success message', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue(createMockUser());

            await service.create(testFirebaseUid, testEmail, dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `User registered successfully: ${testEmail}`,
                'UsersService',
            );
        });

        it('should throw InternalServerErrorException for database errors', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockRejectedValue(new Error('Database error'));

            await expect(service.create(testFirebaseUid, testEmail, dto)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.create(testFirebaseUid, testEmail, dto)).rejects.toThrow(
                'Failed to register user to the database',
            );
        });

        it('should log error for database errors', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockRejectedValue(new Error('Database error'));

            await expect(service.create(testFirebaseUid, testEmail, dto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error registering user: ${testEmail}`,
                'Database error',
                'UsersService',
            );
        });

        it('should create user with all required fields', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);
            mockDatabaseService.user.create.mockResolvedValue({
                id: 'user-id-123',
                testFirebaseUid,
                testEmail,
            });

            await service.create(testFirebaseUid, testEmail, dto);

            expect(mockDatabaseService.user.create).toHaveBeenCalledWith({
                data: {
                    firebaseUid: testFirebaseUid,
                    email: testEmail,
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
            mockDatabaseService.user.findUnique.mockResolvedValue(validUser);

            const result = await service.findById(userId);

            expect(result.message).toBe('User info fetched successfully');
            expect(result.userInfo.id).toBe(userId);
            expect(result.userInfo.email).toBe('test@example.com');
        });

        it('should parse address into components', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(validUser);

            const result = await service.findById(userId);

            expect(result.userInfo.block).toBe('Block 5');
            expect(result.userInfo.street).toBe('Sampaguita St');
            expect(result.userInfo.barangay).toBe('Brgy Commonwealth');
            expect(result.userInfo.city).toBe('Quezon City');
        });

        it('should query database with correct id', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(validUser);

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
            mockDatabaseService.user.findUnique.mockResolvedValue(validUser);

            await service.findById(userId);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `User info fetched: ${validUser.email}`,
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
        it('should find user by Firebase UID successfully', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(validUser);

            const result = await service.findByFirebaseUid(testFirebaseUid);

            expect(result.message).toBe('User info fetched successfully');
            expect(result.userInfo.id).toBe('user-id-123');
        });

        it('should query database with Firebase UID', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(validUser);

            await service.findByFirebaseUid(testFirebaseUid);

            expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
                where: { firebaseUid: testFirebaseUid },
            });
        });

        it('should parse address into components', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(validUser);

            const result = await service.findByFirebaseUid(testFirebaseUid);

            expect(result.userInfo.block).toBe('Block 5');
            expect(result.userInfo.street).toBe('Sampaguita St');
            expect(result.userInfo.barangay).toBe('Brgy Commonwealth');
            expect(result.userInfo.city).toBe('Quezon City');
        });

        it('should throw NotFoundException if user not found', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await expect(service.findByFirebaseUid(testFirebaseUid)).rejects.toThrow(
                NotFoundException,
            );
            // service throws generic "User not found" message here
            await expect(service.findByFirebaseUid(testFirebaseUid)).rejects.toThrow(
                'User not found',
            );
        });

        it('should log success message', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(validUser);

            await service.findByFirebaseUid(testFirebaseUid);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `User info fetched by Firebase UID: ${validUser.email}`,
                'UsersService',
            );
        });

        it('should throw InternalServerErrorException for database errors', async () => {
            mockDatabaseService.user.findUnique.mockRejectedValue(new Error('Database error'));

            await expect(service.findByFirebaseUid(testFirebaseUid)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.findByFirebaseUid(testFirebaseUid)).rejects.toThrow(
                'Failed to fetch user by Firebase UID',
            );
        });

        it('should log error for database errors', async () => {
            mockDatabaseService.user.findUnique.mockRejectedValue(new Error('Database error'));

            await expect(service.findByFirebaseUid(testFirebaseUid)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error fetching user by Firebase UID: ${testFirebaseUid}`,
                'Database error',
                'UsersService',
            );
        });
    });

    describe('update', () => {
        const userId = 'user-id-123';
        const dto: UpdateUserDto = validUpdateUserDto;

        it('should throw NotFoundException if user not found', async () => {
            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            await expect(service.update(userId, dto)).rejects.toThrow(NotFoundException);
            await expect(service.update(userId, dto)).rejects.toThrow('User not found');
        });

        it('should send notification if email changed', async () => {
            const existing = createMockUser({ email: 'old@example.com' });
            mockDatabaseService.user.findUnique.mockResolvedValue(existing);
            mockDatabaseService.user.update.mockResolvedValue(
                createMockUser({
                    email: dto.email,
                    address: 'Block 7, Amaryllis St, Brgy New Field, Muntinlupa City',
                }),
            );

            await service.update(userId, dto);

            expect(mockEmailService.sendEmailResetNotification).toHaveBeenCalledWith(
                'old@example.com',
            );
        });

        it('should update address when address fields provided', async () => {
            const existing = createMockUser({ email: 'old@example.com' });
            mockDatabaseService.user.findUnique.mockResolvedValue(existing);
            mockDatabaseService.user.update.mockResolvedValue(
                createMockUser({
                    address: 'Block 7, Amaryllis St, Brgy New Field, Muntinlupa City',
                }),
            );

            await service.update(userId, dto);

            expect(mockDatabaseService.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: expect.objectContaining({
                    email: dto.email,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    address: 'Block 7, Amaryllis St, Brgy New Field, Muntinlupa City',
                }) as Partial<UpdateUserDto>,
            });
        });

        it('should return parsed userInfo on success', async () => {
            const existing = createMockUser({ email: 'old@example.com' });
            const updated = createMockUser({
                email: dto.email,
                address: 'Block 7, Amaryllis St, Brgy New Field, Muntinlupa City',
            });
            mockDatabaseService.user.findUnique.mockResolvedValue(existing);
            mockDatabaseService.user.update.mockResolvedValue(updated);

            const result = await service.update(userId, dto);

            expect(result.message).toBe('User updated successfully');
            expect(result.userInfo.email).toBe(dto.email);
            expect(result.userInfo.block).toBe('Block 7');
            expect(result.userInfo.city).toBe('Muntinlupa City');
        });

        it('should log success message', async () => {
            const existing = createMockUser({ email: 'old@example.com' });
            mockDatabaseService.user.findUnique.mockResolvedValue(existing);
            mockDatabaseService.user.update.mockResolvedValue(createMockUser());

            await service.update(userId, dto);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                `User updated successfully: ${userId}`,
                'UsersService',
            );
        });

        it('should throw InternalServerErrorException for update errors', async () => {
            const existing = createMockUser();
            mockDatabaseService.user.findUnique.mockResolvedValue(existing);
            mockDatabaseService.user.update.mockRejectedValue(new Error('DB error'));

            await expect(service.update(userId, dto)).rejects.toThrow(InternalServerErrorException);
            await expect(service.update(userId, dto)).rejects.toThrow('Failed to update user');
        });

        it('should log error for update failures', async () => {
            const existing = createMockUser();
            mockDatabaseService.user.findUnique.mockResolvedValue(existing);
            mockDatabaseService.user.update.mockRejectedValue(new Error('DB error'));

            await expect(service.update(userId, dto)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                `Error updating user ${userId}`,
                'DB error',
                'UsersService',
            );
        });

        it('should not call email service if email not present', async () => {
            const existing = createMockUser({ email: 'same@example.com' });
            const partial: UpdateUserDto = { firstName: 'Newname' };
            mockDatabaseService.user.findUnique.mockResolvedValue(existing);
            mockDatabaseService.user.update.mockResolvedValue(createMockUser());

            await service.update(userId, partial);

            expect(mockEmailService.sendEmailResetNotification).not.toHaveBeenCalled();
        });

        it('should propagate email service error as internal error', async () => {
            const existing = createMockUser({ email: 'old@example.com' });
            mockDatabaseService.user.findUnique.mockResolvedValue(existing);
            mockEmailService.sendEmailResetNotification.mockRejectedValue(new Error('Email fail'));
            mockDatabaseService.user.update.mockResolvedValue(createMockUser());

            await expect(service.update(userId, dto)).rejects.toThrow(InternalServerErrorException);
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

            await service.create(testFirebaseUid, testEmail, dto);

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
