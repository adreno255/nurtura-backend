import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { MyLoggerService } from '../my-logger/my-logger.service';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private app: admin.app.App | null = null;

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: MyLoggerService,
    ) {}

    onModuleInit(): void {
        try {
            const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');

            if (!serviceAccountJson) {
                const errorMsg = 'FIREBASE_SERVICE_ACCOUNT is not configured';
                this.logger.error(errorMsg, '', 'FirebaseService');
                throw new Error(errorMsg);
            }

            const serviceAccountKey = JSON.parse(serviceAccountJson) as admin.ServiceAccount;

            this.app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccountKey),
            });

            this.logger.bootstrap('Firebase Admin initialized successfully', 'FirebaseService');
        } catch (error) {
            const errorMsg = `Failed to initialize Firebase Admin: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error(
                'Failed to initialize Firebase Admin',
                error instanceof Error ? error.message : String(error),
                'FirebaseService',
            );
            throw new Error(errorMsg);
        }
    }

    getAuth(): admin.auth.Auth {
        if (!this.app) {
            throw new Error('Firebase app not initialized');
        }
        return admin.auth();
    }
}
