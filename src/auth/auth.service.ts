import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { DatabaseService } from '../database/database.service';
import { EmailQueryDto } from './dto/email-query.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { MyLoggerService } from '../my-logger/my-logger.service';
import {
    AuthProvidersResponse,
    OnboardingStatusResponse,
    UpdatePasswordResponse,
} from './interfaces';
import { isFirebaseAuthError } from '../common/type-guards';
import { CurrentUserPayload } from '../common/interfaces';

@Injectable()
export class AuthService {
    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly databaseService: DatabaseService,
        private readonly logger: MyLoggerService,
    ) {}

    async getProviders(dto: EmailQueryDto): Promise<AuthProvidersResponse> {
        const { email } = dto;

        try {
            const auth = this.firebaseService.getAuth();
            const user = await auth.getUserByEmail(email);

            const providers = user.providerData.map((provider) => provider.providerId);

            this.logger.log(
                `Sign-in providers found for ${email}: ${providers.join(', ')}`,
                'AuthService',
            );

            return { providers };
        } catch (error) {
            if (isFirebaseAuthError(error) && error.code === 'auth/user-not-found') {
                throw new NotFoundException('No user found for this email');
            }

            this.logger.error(
                `Error checking sign-in providers for ${email}`,
                error instanceof Error ? error.message : String(error),
                'AuthService',
            );
            throw new InternalServerErrorException('Failed to check sign-in providers');
        }
    }

    async getOnboardingStatus(dto: EmailQueryDto): Promise<OnboardingStatusResponse> {
        const { email } = dto;

        try {
            const auth = this.firebaseService.getAuth();
            const user = await auth.getUserByEmail(email);

            const providers = user.providerData.map((provider) => provider.providerId);

            if (providers.length === 0) {
                throw new BadRequestException('No sign-in methods found for this user');
            }

            // Check if user profile exists in database using Prisma
            const userProfile = await this.databaseService.user.findUnique({
                where: { firebaseUid: user.uid },
            });

            if (!userProfile) {
                this.logger.log(`User needs onboarding: ${email}`, 'AuthService');
                return {
                    needsOnboarding: true,
                    providers,
                    message: 'User exists in Firebase, but no profile found in database',
                };
            }

            this.logger.log(`User onboarding complete: ${email}`, 'AuthService');
            return {
                needsOnboarding: false,
                message: 'User profile exists',
            };
        } catch (error) {
            if (isFirebaseAuthError(error) && error.code === 'auth/user-not-found') {
                throw new NotFoundException('No user found for this email');
            }

            if (error instanceof BadRequestException) {
                throw error;
            }

            this.logger.error(
                `Error checking onboarding status for ${email}`,
                error instanceof Error ? error.message : String(error),
                'AuthService',
            );
            throw new InternalServerErrorException('Failed to check user status');
        }
    }

    async updatePassword(
        user: CurrentUserPayload,
        dto: UpdatePasswordDto,
    ): Promise<UpdatePasswordResponse> {
        const { newPassword } = dto;

        try {
            const auth = this.firebaseService.getAuth();
            await auth.updateUser(user.firebaseUid, {
                password: newPassword,
            });

            this.logger.log(`Password reset successfully for ${user.email}`, 'AuthService');
            return { message: 'Password updated successfully' };
        } catch (error) {
            if (isFirebaseAuthError(error) && error.code === 'auth/user-not-found') {
                throw new NotFoundException('No user found for this email');
            }

            this.logger.error(
                `Error resetting password for ${user.email}`,
                error instanceof Error ? error.message : String(error),
                'AuthService',
            );
            throw new InternalServerErrorException('Failed to reset password');
        }
    }
}
