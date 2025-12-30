import {
    Injectable,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FirebaseService } from '../firebase/firebase.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CheckEmailAvailabilityDto } from './dto/check-email-availability.dto';
import {
    EmailAvailabilityResponse,
    UserCreatedResponse,
    UserInfoResponse,
    UserInfo,
} from './interfaces/user.interface';
import { isFirebaseAuthError } from 'src/common/type-guards';

@Injectable()
export class UsersService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly firebaseService: FirebaseService,
        private readonly logger: MyLoggerService,
    ) {}

    async checkEmailAvailability(
        dto: CheckEmailAvailabilityDto,
    ): Promise<EmailAvailabilityResponse> {
        const { email } = dto;

        try {
            const auth = this.firebaseService.getAuth();
            await auth.getUserByEmail(email);

            this.logger.log(`Email already registered: ${email}`, 'UsersService');
            return {
                available: false,
                message: 'Email is already registered',
            };
        } catch (error) {
            if (isFirebaseAuthError(error) && error.code === 'auth/user-not-found') {
                this.logger.log(`Email available: ${email}`, 'UsersService');
                return {
                    available: true,
                    message: 'Email is available',
                };
            }

            this.logger.error(
                `Error checking email availability: ${email}`,
                error instanceof Error ? error.message : String(error),
                'UsersService',
            );
            throw new InternalServerErrorException('Failed to check email availability');
        }
    }

    async create(
        firebaseUid: string,
        email: string,
        dto: CreateUserDto,
    ): Promise<UserCreatedResponse> {
        try {
            // Check if user already exists in database
            const existingUser = await this.databaseService.user.findUnique({
                where: { firebaseUid },
            });

            if (existingUser) {
                throw new ConflictException('User profile already exists');
            }

            // Clean and format data
            const firstName = dto.firstName.trim();
            const middleName = dto.middleName?.trim() || null;
            const lastName = dto.lastName.trim();
            const suffix = dto.suffix?.trim() || null;

            const addressParts = [dto.block, dto.street, dto.barangay, dto.city]
                .map((part) => part.trim())
                .filter((part) => part !== '');

            const address = addressParts.join(', ');

            // Create user in database
            const user = await this.databaseService.user.create({
                data: {
                    firebaseUid,
                    email,
                    firstName,
                    middleName,
                    lastName,
                    suffix,
                    address,
                },
            });

            this.logger.log(`User registered successfully: ${email}`, 'UsersService');

            return {
                message: 'User registered successfully',
                userId: user.id,
            };
        } catch (error) {
            if (error instanceof ConflictException) {
                throw error;
            }

            this.logger.error(
                `Error registering user: ${email}`,
                error instanceof Error ? error.message : String(error),
                'UsersService',
            );
            throw new InternalServerErrorException('Failed to register user to the database');
        }
    }

    async findById(id: string): Promise<UserInfoResponse> {
        try {
            const user = await this.databaseService.user.findUnique({
                where: { id },
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Parse address
            const addressParts = user.address
                .split(',')
                .map((part) => part.trim())
                .filter((part) => part !== '');

            const userInfo: UserInfo = {
                id: user.id,
                firstName: user.firstName,
                middleName: user.middleName,
                lastName: user.lastName,
                suffix: user.suffix,
                email: user.email,
                address: user.address,
                block: addressParts[0] || '',
                street: addressParts[1] || '',
                barangay: addressParts[2] || '',
                city: addressParts[3] || '',
            };

            this.logger.log(`User info fetched: ${user.email}`, 'UsersService');

            return {
                message: 'User info fetched successfully',
                userInfo,
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(
                `Error fetching user by ID: ${id}`,
                error instanceof Error ? error.message : String(error),
                'UsersService',
            );

            throw new InternalServerErrorException('Failed to fetch user by ID');
        }
    }

    async findByFirebaseUid(firebaseUid: string): Promise<UserInfoResponse> {
        try {
            const user = await this.databaseService.user.findUnique({
                where: { firebaseUid },
            });

            if (!user) {
                throw new NotFoundException('User profile not found in database');
            }

            // Parse address
            const addressParts = user.address
                .split(',')
                .map((part) => part.trim())
                .filter((part) => part !== '');

            const userInfo: UserInfo = {
                id: user.id,
                firstName: user.firstName,
                middleName: user.middleName,
                lastName: user.lastName,
                suffix: user.suffix,
                email: user.email,
                address: user.address,
                block: addressParts[0] || '',
                street: addressParts[1] || '',
                barangay: addressParts[2] || '',
                city: addressParts[3] || '',
            };

            this.logger.log(`User info fetched by Firebase UID: ${user.email}`, 'UsersService');

            return {
                message: 'User info fetched successfully',
                userInfo,
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(
                `Error fetching user by Firebase UID: ${firebaseUid}`,
                error instanceof Error ? error.message : String(error),
                'UsersService',
            );

            throw new InternalServerErrorException('Failed to fetch user by Firebase UID');
        }
    }
}
