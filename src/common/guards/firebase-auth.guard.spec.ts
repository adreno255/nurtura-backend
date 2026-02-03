import { Test, type TestingModule } from '@nestjs/testing';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { Reflector } from '@nestjs/core';
import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { type Observable } from 'rxjs';

// Setup a global spy for the base class method
// We define this outside the test so we can track calls to 'super.canActivate()'
const mockCanActivate = jest.fn<
    boolean | Promise<boolean> | Observable<boolean>,
    [ExecutionContext]
>();

// Mock @nestjs/passport before imports
// This replaces the actual AuthGuard mixin with a simple class we control
jest.mock('@nestjs/passport', () => ({
    AuthGuard: () => {
        return class MockAuthGuard {
            canActivate(context: ExecutionContext) {
                return mockCanActivate(context);
            }
        };
    },
}));

describe('FirebaseAuthGuard', () => {
    let guard: FirebaseAuthGuard;
    let reflector: Reflector;
    let context: ExecutionContext;

    beforeEach(async () => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Create the Mock ExecutionContext
        context = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
        } as unknown as ExecutionContext;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FirebaseAuthGuard,
                {
                    provide: Reflector,
                    useValue: {
                        getAllAndOverride: jest.fn(),
                    },
                },
            ],
        }).compile();

        guard = module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
        reflector = module.get<Reflector>(Reflector);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    describe('canActivate', () => {
        it('should return true immediately if the route is public', () => {
            // Arrange: Reflector returns TRUE (Public)
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

            // Act
            const result = guard.canActivate(context);

            // Assert
            expect(result).toBe(true);
            expect(jest.spyOn(reflector, 'getAllAndOverride')).toHaveBeenCalled();
            // Critical: Ensure we did NOT try to run passport logic
            expect(mockCanActivate).not.toHaveBeenCalled();
        });

        it('should call super.canActivate() if route is NOT public', () => {
            // Arrange: Reflector returns FALSE (Protected)
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
            // Simulate the parent class returning true (valid token)
            mockCanActivate.mockReturnValue(true);

            // Act
            const result = guard.canActivate(context);

            // Assert
            expect(result).toBe(true);
            expect(mockCanActivate).toHaveBeenCalledWith(context);
        });
    });

    describe('handleRequest', () => {
        const mockUser = { uid: '123', email: 'test@test.com' };

        it('should return the user if authentication is successful', () => {
            const result = guard.handleRequest(null, mockUser, null, context);
            expect(result).toEqual(mockUser);
        });

        it('should throw UnauthorizedException if user is false (not found)', () => {
            expect(() => {
                guard.handleRequest(null, false, null, context);
            }).toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if user is undefined/null', () => {
            expect(() => {
                guard.handleRequest(null, null, null, context);
            }).toThrow(UnauthorizedException);
        });

        it('should throw the actual error if one occurred during strategy validation', () => {
            const strategyError = new Error('Token expired');
            expect(() => {
                guard.handleRequest(strategyError, false, null, context);
            }).toThrow(strategyError);
        });

        it('should throw UnauthorizedException with custom message "Authentication required"', () => {
            try {
                guard.handleRequest(null, false, null, context);
            } catch (error) {
                expect(error).toBeInstanceOf(UnauthorizedException);
                expect((error as UnauthorizedException).message).toBe('Authentication required');
            }
        });
    });
});
