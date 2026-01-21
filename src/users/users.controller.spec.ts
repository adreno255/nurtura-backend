import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { type CheckEmailAvailabilityDto } from './dto/check-email-availability.dto';
import { type CreateUserDto } from './dto/create-user.dto';
import { type CurrentUserPayload } from '../common/interfaces';
import {
    minimalCreateUserDto,
    parsedUser,
    testEmails,
    testFirebaseUids,
    validCreateUserDto,
    validEmailQueryDto,
    validUser,
} from '../../test/fixtures';

describe('UsersController', () => {
    let controller: UsersController;

    const mockUsersService = {
        checkEmailAvailability: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
        findByFirebaseUid: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
            ],
        }).compile();

        controller = module.get<UsersController>(UsersController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('checkEmail', () => {
        const dto: CheckEmailAvailabilityDto = validEmailQueryDto;

        it('should return email availability as available', async () => {
            const mockResponse = {
                available: true,
                message: 'Email is available',
            };
            mockUsersService.checkEmailAvailability.mockResolvedValue(mockResponse);

            const result = await controller.checkEmail(dto);

            expect(result).toEqual(mockResponse);
        });

        it('should return email availability as not available', async () => {
            const mockResponse = {
                available: false,
                message: 'Email is already registered',
            };
            mockUsersService.checkEmailAvailability.mockResolvedValue(mockResponse);

            const result = await controller.checkEmail(dto);

            expect(result).toEqual(mockResponse);
        });

        it('should call UsersService.checkEmailAvailability with correct DTO', async () => {
            mockUsersService.checkEmailAvailability.mockResolvedValue({
                available: true,
                message: 'Email is available',
            });

            await controller.checkEmail(dto);

            expect(mockUsersService.checkEmailAvailability).toHaveBeenCalledWith(dto);
        });

        it('should call UsersService.checkEmailAvailability once', async () => {
            mockUsersService.checkEmailAvailability.mockResolvedValue({
                available: true,
                message: 'Email is available',
            });

            await controller.checkEmail(dto);

            expect(mockUsersService.checkEmailAvailability).toHaveBeenCalledTimes(1);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockUsersService.checkEmailAvailability.mockRejectedValue(
                new InternalServerErrorException('Failed to check email availability'),
            );

            await expect(controller.checkEmail(dto)).rejects.toThrow(InternalServerErrorException);
        });

        it('should work with different email formats', async () => {
            const emails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org'];

            for (const email of emails) {
                mockUsersService.checkEmailAvailability.mockResolvedValue({
                    available: true,
                    message: 'Email is available',
                });

                const testDto: CheckEmailAvailabilityDto = { email };
                await controller.checkEmail(testDto);

                expect(mockUsersService.checkEmailAvailability).toHaveBeenCalledWith(testDto);
            }
        });

        it('should return response with available boolean', async () => {
            mockUsersService.checkEmailAvailability.mockResolvedValue({
                available: true,
                message: 'Email is available',
            });

            const result = await controller.checkEmail(dto);

            expect(result).toHaveProperty('available');
            expect(typeof result.available).toBe('boolean');
        });

        it('should return response with message string', async () => {
            mockUsersService.checkEmailAvailability.mockResolvedValue({
                available: true,
                message: 'Email is available',
            });

            const result = await controller.checkEmail(dto);

            expect(result).toHaveProperty('message');
            expect(typeof result.message).toBe('string');
        });
    });

    describe('createUser', () => {
        const currentUser: CurrentUserPayload = {
            firebaseUid: testFirebaseUids.primary,
            email: testEmails.valid,
        };

        const dto: CreateUserDto = validCreateUserDto;

        it('should create user successfully', async () => {
            const mockResponse = {
                message: 'User registered successfully',
                userId: 'user-id-123',
            };
            mockUsersService.create.mockResolvedValue(mockResponse);

            const result = await controller.createUser(currentUser, dto);

            expect(result).toEqual(mockResponse);
        });

        it('should call UsersService.create with correct parameters', async () => {
            mockUsersService.create.mockResolvedValue({
                message: 'User registered successfully',
                userId: 'user-id-123',
            });

            await controller.createUser(currentUser, dto);

            expect(mockUsersService.create).toHaveBeenCalledWith(
                currentUser.firebaseUid,
                currentUser.email,
                dto,
            );
        });

        it('should call UsersService.create once', async () => {
            mockUsersService.create.mockResolvedValue({
                message: 'User registered successfully',
                userId: 'user-id-123',
            });

            await controller.createUser(currentUser, dto);

            expect(mockUsersService.create).toHaveBeenCalledTimes(1);
        });

        it('should extract firebaseUid from current user', async () => {
            mockUsersService.create.mockResolvedValue({
                message: 'User registered successfully',
                userId: 'user-id-123',
            });

            await controller.createUser(currentUser, dto);

            expect(mockUsersService.create).toHaveBeenCalledWith(
                expect.stringContaining('test-firebase-uid'),
                expect.any(String),
                expect.any(Object),
            );
        });

        it('should extract email from current user', async () => {
            mockUsersService.create.mockResolvedValue({
                message: 'User registered successfully',
                userId: 'user-id-123',
            });

            await controller.createUser(currentUser, dto);

            expect(mockUsersService.create).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('test@example.com'),
                expect.any(Object),
            );
        });

        it('should propagate ConflictException from service', async () => {
            mockUsersService.create.mockRejectedValue(
                new ConflictException('User profile already exists'),
            );

            await expect(controller.createUser(currentUser, dto)).rejects.toThrow(
                ConflictException,
            );
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockUsersService.create.mockRejectedValue(
                new InternalServerErrorException('Failed to register user to the database'),
            );

            await expect(controller.createUser(currentUser, dto)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should work with user without middle name', async () => {
            const dtoWithoutMiddleName: CreateUserDto = minimalCreateUserDto;

            mockUsersService.create.mockResolvedValue({
                message: 'User registered successfully',
                userId: 'user-id-123',
            });

            await controller.createUser(currentUser, dtoWithoutMiddleName);

            expect(mockUsersService.create).toHaveBeenCalledWith(
                currentUser.firebaseUid,
                currentUser.email,
                dtoWithoutMiddleName,
            );
        });

        it('should work with user without suffix', async () => {
            const dtoWithoutSuffix: CreateUserDto = minimalCreateUserDto;

            mockUsersService.create.mockResolvedValue({
                message: 'User registered successfully',
                userId: 'user-id-123',
            });

            await controller.createUser(currentUser, dtoWithoutSuffix);

            expect(mockUsersService.create).toHaveBeenCalledWith(
                currentUser.firebaseUid,
                currentUser.email,
                dtoWithoutSuffix,
            );
        });

        it('should return response with message', async () => {
            mockUsersService.create.mockResolvedValue({
                message: 'User registered successfully',
                userId: 'user-id-123',
            });

            const result = await controller.createUser(currentUser, dto);

            expect(result).toHaveProperty('message');
            expect(result.message).toBe('User registered successfully');
        });

        it('should return response with userId', async () => {
            mockUsersService.create.mockResolvedValue({
                message: 'User registered successfully',
                userId: 'user-id-123',
            });

            const result = await controller.createUser(currentUser, dto);

            expect(result).toHaveProperty('userId');
            expect(typeof result.userId).toBe('string');
        });
    });

    describe('getUserById', () => {
        const firebaseUid = testFirebaseUids.primary;

        it('should get user by Firebase UID successfully', async () => {
            const mockResponse = {
                message: 'User info fetched successfully',
                userInfo: validUser,
            };

            mockUsersService.findByFirebaseUid.mockResolvedValue(mockResponse);

            const result = await controller.getUserById(firebaseUid);

            expect(result).toEqual(mockResponse);
        });

        it('should call UsersService.findByFirebaseUid with correct parameter', async () => {
            mockUsersService.findByFirebaseUid.mockResolvedValue({
                message: 'User info fetched successfully',
                userInfo: validUser,
            });

            await controller.getUserById(firebaseUid);

            expect(mockUsersService.findByFirebaseUid).toHaveBeenCalledWith(firebaseUid);
        });

        it('should call UsersService.findByFirebaseUid once', async () => {
            mockUsersService.findByFirebaseUid.mockResolvedValue({
                message: 'User info fetched successfully',
                userInfo: validUser,
            });

            await controller.getUserById(firebaseUid);

            expect(mockUsersService.findByFirebaseUid).toHaveBeenCalledTimes(1);
        });

        it('should propagate NotFoundException from service', async () => {
            mockUsersService.findByFirebaseUid.mockRejectedValue(
                new NotFoundException('User profile not found in database'),
            );

            await expect(controller.getUserById(firebaseUid)).rejects.toThrow(NotFoundException);
        });

        it('should propagate InternalServerErrorException from service', async () => {
            mockUsersService.findByFirebaseUid.mockRejectedValue(
                new InternalServerErrorException('Failed to fetch user by Firebase UID'),
            );

            await expect(controller.getUserById(firebaseUid)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should return response with message', async () => {
            mockUsersService.findByFirebaseUid.mockResolvedValue({
                message: 'User info fetched successfully',
                userInfo: validUser,
            });

            const result = await controller.getUserById(firebaseUid);

            expect(result).toHaveProperty('message');
            expect(result.message).toBe('User info fetched successfully');
        });

        it('should return response with userInfo', async () => {
            mockUsersService.findByFirebaseUid.mockResolvedValue({
                message: 'User info fetched successfully',
                userInfo: validUser,
            });

            const result = await controller.getUserById(firebaseUid);

            expect(result).toHaveProperty('userInfo');
            expect(result.userInfo).toHaveProperty('id');
            expect(result.userInfo).toHaveProperty('email');
            expect(result.userInfo).toHaveProperty('address');
        });

        it('should return userInfo with parsed address components', async () => {
            mockUsersService.findByFirebaseUid.mockResolvedValue({
                message: 'User info fetched successfully',
                userInfo: parsedUser,
            });

            const result = await controller.getUserById(firebaseUid);

            expect(result.userInfo).toHaveProperty('block');
            expect(result.userInfo).toHaveProperty('street');
            expect(result.userInfo).toHaveProperty('barangay');
            expect(result.userInfo).toHaveProperty('city');
        });

        it('should work with different Firebase UIDs', async () => {
            const uids = ['uid-123', 'firebase-abc', 'test-uid-xyz'];

            for (const uid of uids) {
                mockUsersService.findByFirebaseUid.mockResolvedValue({
                    message: 'User info fetched successfully',
                    userInfo: validUser,
                });

                await controller.getUserById(uid);

                expect(mockUsersService.findByFirebaseUid).toHaveBeenCalledWith(uid);
            }
        });
    });

    describe('integration with UsersService', () => {
        it('should delegate all logic to UsersService', async () => {
            mockUsersService.checkEmailAvailability.mockResolvedValue({
                available: true,
                message: 'Email is available',
            });
            mockUsersService.create.mockResolvedValue({
                message: 'User registered successfully',
                userId: 'user-id-123',
            });
            mockUsersService.findByFirebaseUid.mockResolvedValue({
                message: 'User info fetched successfully',
                userInfo: validUser,
            });

            await controller.checkEmail({ email: 'test@example.com' });
            await controller.createUser(
                { firebaseUid: 'test-uid', email: 'test@example.com' },
                {
                    firstName: 'John',
                    lastName: 'Doe',
                    block: 'Block 5',
                    street: 'Sampaguita St',
                    barangay: 'Brgy Commonwealth',
                    city: 'Quezon City',
                },
            );
            await controller.getUserById('test-uid');

            expect(mockUsersService.checkEmailAvailability).toHaveBeenCalled();
            expect(mockUsersService.create).toHaveBeenCalled();
            expect(mockUsersService.findByFirebaseUid).toHaveBeenCalled();
        });

        it('should not add additional business logic', async () => {
            mockUsersService.checkEmailAvailability.mockResolvedValue({
                available: true,
                message: 'Email is available',
            });

            const dto: CheckEmailAvailabilityDto = { email: 'test@example.com' };
            await controller.checkEmail(dto);

            // Should pass DTO directly to service without modification
            expect(mockUsersService.checkEmailAvailability).toHaveBeenCalledWith(dto);
        });

        it('should return service responses directly', async () => {
            const serviceResponse = {
                available: true,
                message: 'Email is available',
            };
            mockUsersService.checkEmailAvailability.mockResolvedValue(serviceResponse);

            const result = await controller.checkEmail({ email: 'test@example.com' });

            expect(result).toBe(serviceResponse);
        });
    });

    describe('error propagation', () => {
        it('should not catch service errors in checkEmail', async () => {
            const serviceError = new InternalServerErrorException('Service error');
            mockUsersService.checkEmailAvailability.mockRejectedValue(serviceError);

            await expect(controller.checkEmail({ email: 'test@example.com' })).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should not catch service errors in createUser', async () => {
            const serviceError = new ConflictException('User already exists');
            mockUsersService.create.mockRejectedValue(serviceError);

            await expect(
                controller.createUser(
                    { firebaseUid: 'test-uid', email: 'test@example.com' },
                    {
                        firstName: 'John',
                        lastName: 'Doe',
                        block: 'Block 5',
                        street: 'Sampaguita St',
                        barangay: 'Brgy Commonwealth',
                        city: 'Quezon City',
                    },
                ),
            ).rejects.toThrow(ConflictException);
        });

        it('should not catch service errors in getUserById', async () => {
            const serviceError = new NotFoundException('User not found');
            mockUsersService.findByFirebaseUid.mockRejectedValue(serviceError);

            await expect(controller.getUserById('test-uid')).rejects.toThrow(NotFoundException);
        });
    });
});
