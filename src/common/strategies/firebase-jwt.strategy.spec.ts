import { Test, type TestingModule } from '@nestjs/testing';
import { FirebaseJwtStrategy } from './firebase-jwt.strategy';
import { FirebaseService } from '../../firebase/firebase.service';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import { UnauthorizedException } from '@nestjs/common';
import { type DecodedIdToken } from 'firebase-admin/auth';
import {
    createMockFirebaseAuth,
    createMockFirebaseService,
    createMockLogger,
} from '../../../test/mocks';

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

    const mockLoggerService = createMockLogger();

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FirebaseJwtStrategy,
                { provide: FirebaseService, useValue: mockFirebaseService },
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

        it('should return a user payload when token is valid', async () => {
            // Arrange
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(mockDecodedToken);

            // Act
            const result = await strategy.validate(mockToken);

            // Assert
            expect(result).toEqual({
                firebaseUid: 'firebase-user-123',
                email: 'test@nurtura.com',
            });
            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining('User authenticated: test@nurtura.com'),
                'FirebaseJwtStrategy',
            );
        });

        it('should use empty string if email is missing in token', async () => {
            const tokenWithoutEmail = { uid: 'uid-only' };
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue(tokenWithoutEmail);

            const result = await strategy.validate(mockToken);

            expect(result.email).toBe('');
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

        it('should log the UID if email is not available during successful auth', async () => {
            mockFirebaseService.getAuth().verifyIdToken.mockResolvedValue({
                uid: 'uid-123',
            });

            await strategy.validate(mockToken);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining('User authenticated: uid-123'),
                'FirebaseJwtStrategy',
            );
        });
    });
});
