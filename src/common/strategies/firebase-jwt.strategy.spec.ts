import { Test, type TestingModule } from '@nestjs/testing';
import { FirebaseJwtStrategy } from './firebase-jwt.strategy';
import { FirebaseService } from '../../firebase/firebase.service';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import { UnauthorizedException } from '@nestjs/common';
import { type DecodedIdToken } from 'firebase-admin/auth';
import {
    createMockDatabaseService,
    createMockFirebaseAuth,
    createMockFirebaseService,
    createMockLogger,
} from '../../../test/mocks';
import { DatabaseService } from '../../database/database.service';

// 1. Mock PassportStrategy to avoid real passport initialization
jest.mock('@nestjs/passport', () => ({
    PassportStrategy: jest.fn(
        () =>
            class MockStrategy {
                constructor() {}
            },
    ),
}));

// 2. Mock passport-firebase-jwt
jest.mock('passport-firebase-jwt', () => ({
    Strategy: class {},
    ExtractJwt: {
        fromAuthHeaderAsBearerToken: jest.fn(() => () => 'mock-token'),
    },
}));

describe('FirebaseJwtStrategy', () => {
    let strategy: FirebaseJwtStrategy;

    const mockFirebaseAuth = createMockFirebaseAuth();

    const mockFirebaseService = createMockFirebaseService(mockFirebaseAuth);

    const mockDatabaseService = createMockDatabaseService();

    const mockLoggerService = createMockLogger();

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FirebaseJwtStrategy,
                { provide: FirebaseService, useValue: mockFirebaseService },
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: MyLoggerService, useValue: mockLoggerService },
            ],
        }).compile();

        strategy = module.get<FirebaseJwtStrategy>(FirebaseJwtStrategy);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    describe('validate', () => {
        const mockToken = 'valid-token';
        const mockDecodedToken: Partial<DecodedIdToken> = {
            uid: 'firebase-user-123',
            email: 'test@nurtura.com',
        };

        it('should return a user payload when token is valid and user is not in DB', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(mockDecodedToken);

            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            const result = await strategy.validate(mockToken);

            expect(result).toEqual({
                dbId: '',
                firebaseUid: 'firebase-user-123',
                email: 'test@nurtura.com',
            });
        });

        it('should return DB-backed user payload when user exists in database', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(mockDecodedToken);

            mockDatabaseService.user.findUnique.mockResolvedValue({
                id: 'db-user-1',
                firebaseUid: 'firebase-user-123',
                email: 'test@nurtura.com',
            });

            const result = await strategy.validate(mockToken);

            expect(result).toEqual({
                dbId: 'db-user-1',
                firebaseUid: 'firebase-user-123',
                email: 'test@nurtura.com',
            });

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                'User authenticated: test@nurtura.com',
                'FirebaseJwtStrategy',
            );
        });

        it('should use empty string if email is missing in token', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue({
                uid: 'uid-only',
            });

            mockDatabaseService.user.findUnique.mockResolvedValue(null);

            const result = await strategy.validate(mockToken);

            expect(result).toEqual({
                dbId: '',
                firebaseUid: 'uid-only',
                email: '',
            });
        });

        it('should throw UnauthorizedException and log warning when token is invalid', async () => {
            // Arrange
            mockFirebaseService
                .getAuth()
                .verifyIdToken.mockRejectedValue(new Error('Invalid token'));

            // Act & Assert
            await expect(strategy.validate('invalid-token')).rejects.toThrow(UnauthorizedException);

            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                'Invalid or expired Firebase token',
                'FirebaseJwtStrategy',
            );
        });

        it('should log the UID if email is not available and user exists in DB', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue({
                uid: 'uid-123',
            });

            mockDatabaseService.user.findUnique.mockResolvedValue({
                id: 'db-id',
                firebaseUid: 'uid-123',
                email: '',
            });

            await strategy.validate(mockToken);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                'User authenticated: uid-123',
                'FirebaseJwtStrategy',
            );
        });
    });
});
