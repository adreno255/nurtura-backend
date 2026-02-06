import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-firebase-jwt';
import { FirebaseService } from '../../firebase/firebase.service';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import { DecodedIdToken } from 'firebase-admin/auth';
import { DatabaseService } from '../../database/database.service';
import { CurrentUserPayload } from '../interfaces';

@Injectable()
export class FirebaseJwtStrategy extends PassportStrategy(Strategy, 'firebase-jwt') {
    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly databaseService: DatabaseService,
        private readonly logger: MyLoggerService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: 'nurtura-b967b',
            passReqToCallback: false,
        });
    }

    async validate(token: string) {
        const dbUser = await this.extractUserCredentials(token);

        const user: CurrentUserPayload = {
            dbId: dbUser.id,
            firebaseUid: dbUser.firebaseUid,
            email: dbUser.email,
        };

        this.logger.log(
            `User authenticated: ${user.email || user.firebaseUid}`,
            'FirebaseJwtStrategy',
        );

        return user;
    }

    async extractUserCredentials(
        token: string,
    ): Promise<{ id: string; firebaseUid: string; email: string }> {
        let decodedToken: DecodedIdToken;

        try {
            decodedToken = await this.firebaseService.getAuth().verifyIdToken(token);
        } catch {
            this.logger.warn('Invalid or expired Firebase token', 'FirebaseJwtStrategy');
            throw new UnauthorizedException('Invalid or expired token');
        }

        const dbUser = await this.databaseService.user.findUnique({
            where: { firebaseUid: decodedToken.uid },
            select: { id: true, firebaseUid: true, email: true },
        });

        if (!dbUser) {
            return {
                id: '',
                firebaseUid: decodedToken.uid,
                email: decodedToken.email || '',
            };
        }

        return dbUser;
    }

    // For testing purposes only - bypasses Firebase authentication
    async extractUserCredentialsBypass(
        token: string,
    ): Promise<{ id: string; firebaseUid: string; email: string }> {
        await new Promise((resolve) => setTimeout(resolve, 10));

        const dbUser = {
            id: 'test-uid',
            firebaseUid: 'test-firebase-uid',
            email: 'test@example.com',
        };

        this.logger.warn(
            `Auth bypass enabled for client ${dbUser.id} with token: ${token} - FOR TESTING ONLY`,
            'FirebaseJwtStrategy',
        );

        return dbUser;
    }
}
