import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { DatabaseService } from '../database/database.service';
import { EmailQueryDto } from './dto/email-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MyLoggerService } from '../my-logger/my-logger.service';
import {
    AuthProvidersResponse,
    OnboardingStatusResponse,
    PasswordResetResponse,
    FirebaseAuthError,
} from './interfaces';

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
            if (this.isFirebaseAuthError(error) && error.code === 'auth/user-not-found') {
                this.logger.log(`No user found for email: ${email}`, 'AuthService');
                return { providers: [] };
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
                where: { id: user.uid },
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
            if (this.isFirebaseAuthError(error) && error.code === 'auth/user-not-found') {
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

    async resetPassword(dto: ResetPasswordDto): Promise<PasswordResetResponse> {
        const { email, newPassword } = dto;

        try {
            const auth = this.firebaseService.getAuth();
            const user = await auth.getUserByEmail(email);

            await auth.updateUser(user.uid, {
                password: newPassword,
            });

            this.logger.log(`Password reset successfully for ${email}`, 'AuthService');
            return { message: 'Password updated successfully' };
        } catch (error) {
            if (this.isFirebaseAuthError(error) && error.code === 'auth/user-not-found') {
                throw new NotFoundException('No user found for this email');
            }

            this.logger.error(
                `Error resetting password for ${email}`,
                error instanceof Error ? error.message : String(error),
                'AuthService',
            );
            throw new InternalServerErrorException('Failed to reset password');
        }
    }

    // Type guard helper
    private isFirebaseAuthError(error: unknown): error is FirebaseAuthError {
        return error instanceof Error && 'code' in error && typeof error.code === 'string';
    }
}
