/**
 * Auth Test Fixtures
 * Reusable test data for authentication tests
 */

import { type EmailQueryDto } from '../../src/auth/dto/email-query.dto';
import { type ResetPasswordDto } from '../../src/auth/dto/reset-password.dto';

/**
 * Valid email query DTOs
 */
export const validEmailQueryDto: EmailQueryDto = {
    email: 'test@example.com',
};

export const alternativeEmailQueryDto: EmailQueryDto = {
    email: 'user@test.com',
};

/**
 * Valid password reset DTOs
 */
export const validResetPasswordDto: ResetPasswordDto = {
    email: 'test@example.com',
    newPassword: 'NewSecurePass123!',
};

export const alternativeResetPasswordDto: ResetPasswordDto = {
    email: 'user@test.com',
    newPassword: 'AnotherPass456@',
};

/**
 * Common test passwords
 */
export const testPasswords = {
    valid: 'SecurePass123!',
    alternative: 'StrongPass456@',
    weak: 'pass123', // Does not meet requirements
    noUppercase: 'lowercase123!',
    noLowercase: 'UPPERCASE123!',
    noDigit: 'NoDigitPass!',
    noSpecial: 'NoSpecialPass123',
};

/**
 * Mock Firebase User Responses
 */
export const mockFirebaseUserWithPassword = {
    uid: 'test-uid',
    email: 'test@example.com',
    emailVerified: true,
    providerData: [
        {
            providerId: 'password',
            uid: 'test@example.com',
            email: 'test@example.com',
        },
    ],
};

export const mockFirebaseUserWithGoogle = {
    uid: 'test-uid-google',
    email: 'test@example.com',
    emailVerified: true,
    providerData: [
        {
            providerId: 'google.com',
            uid: 'google-uid-123',
            email: 'test@example.com',
        },
    ],
};

export const mockFirebaseUserWithMultipleProviders = {
    uid: 'test-uid-multi',
    email: 'test@example.com',
    emailVerified: true,
    providerData: [
        {
            providerId: 'password',
            uid: 'test@example.com',
            email: 'test@example.com',
        },
        {
            providerId: 'google.com',
            uid: 'google-uid-456',
            email: 'test@example.com',
        },
    ],
};

export const mockFirebaseUserNoProviders = {
    uid: 'test-uid-no-provider',
    email: 'test@example.com',
    emailVerified: true,
    providerData: [],
};

/**
 * Expected provider responses
 */
export const expectedProviderResponses = {
    password: {
        providers: ['password'],
    },
    google: {
        providers: ['google.com'],
    },
    multiple: {
        providers: ['password', 'google.com'],
    },
    none: {
        providers: [],
    },
};

/**
 * Expected onboarding status responses
 */
export const expectedOnboardingResponses = {
    needsOnboarding: {
        needsOnboarding: true,
        providers: ['password'],
        message: 'User exists in Firebase, but no profile found in database',
    },
    onboardingComplete: {
        needsOnboarding: false,
        message: 'User profile exists',
    },
};
