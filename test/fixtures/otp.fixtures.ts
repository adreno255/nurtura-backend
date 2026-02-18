/**
 * OTP Test Fixtures
 * Reusable test data for OTP-related tests
 */

import { type SendOtpRequestDto } from '../../src/auth/otp/dto/send-otp-request.dto';
import { type VerifyOtpDto } from '../../src/auth/otp/dto/verify-otp.dto';

/**
 * Valid SendOtpRequestDto
 */
export const validSendOtpDto: SendOtpRequestDto = {
    email: 'test@example.com',
};

export const alternativeSendOtpDto: SendOtpRequestDto = {
    email: 'user@test.com',
};

/**
 * Valid VerifyOtpDto - Registration
 */
export const validVerifyOtpRegistrationDto: VerifyOtpDto = {
    email: 'test@example.com',
    code: '12345',
    purpose: 'registration',
};

/**
 * Valid VerifyOtpDto - Password Rest
 */
export const validVerifyOtpPasswordResetDto: VerifyOtpDto = {
    email: 'test@example.com',
    code: '54321',
    purpose: 'password-reset',
};

/**
 * Invalid VerifyOtpDto - Wrong code
 */
export const invalidCodeVerifyOtpDto: VerifyOtpDto = {
    email: 'test@example.com',
    code: '00000',
    purpose: 'registration',
};

/**
 * Invalid VerifyOtpDto - Wrong purpose
 */
export const wrongPurposeVerifyOtpDto: VerifyOtpDto = {
    email: 'test@example.com',
    code: '12345',
    purpose: 'password-reset', // Wrong purpose
};

/**
 * Common test OTP codes
 */
export const testOtpCodes = {
    valid: '12345',
    alternative: '54321',
    expired: '99999',
    invalid: '00000',
};

/**
 * Mock OTP expiry times
 */
export const testExpiryTimes = {
    future: '11:45 AM', // 15 minutes from now
    past: '10:00 AM', // Already expired
    current: new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
    }),
};

/**
 * Mock OTP records (internal storage format)
 */
export const mockOtpRecord = {
    code: '12345',
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes from now
    purpose: 'registration' as const,
};

export const mockExpiredOtpRecord = {
    code: '99999',
    expiresAt: Date.now() - 1000, // Already expired
    purpose: 'registration' as const,
};

export const mockForgotPasswordOtpRecord = {
    code: '54321',
    expiresAt: Date.now() + 15 * 60 * 1000,
    purpose: 'forgot-password' as const,
};

/**
 * Expected OTP response messages
 */
export const expectedOtpResponses = {
    registrationSent: {
        message: 'Registration OTP sent successfully. Please check your email.',
    },
    forgotPasswordSent: {
        message: 'Password reset OTP sent successfully. Please check your email.',
    },
    verified: {
        message: 'OTP verified successfully.',
    },
};

/**
 * Expected OTP error messages
 */
export const expectedOtpErrors = {
    notFound: 'No OTP found for this email. Please request a new one.',
    expired: 'OTP has expired. Please request a new one.',
    invalid: 'Invalid OTP code. Please check and try again.',
    purposeMismatch: 'Invalid OTP context. Please use the correct verification flow.',
};
