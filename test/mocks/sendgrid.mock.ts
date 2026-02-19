/**
 * SendGrid Mock Utilities
 * Reusable mocks for SendGrid email service
 */

export const createMockSendGrid = () => ({
    setApiKey: jest.fn(),
    send: jest.fn().mockResolvedValue([{ statusCode: 200 }, {}]),
});

/**
 * Mock SendGrid Response
 */
export const createMockSendGridResponse = (statusCode = 200) => [{ statusCode }, {}];

/**
 * Mock SendGrid Error
 */
export const createSendGridError = (message: string, code = 400) => {
    return Object.assign(new Error(message), {
        code,
        response: {
            body: {
                errors: [{ message, field: null, help: null }],
            },
        },
    });
};

/**
 * Common SendGrid Error Presets
 */
export const SendGridErrors = {
    invalidApiKey: () => createSendGridError('Invalid API key', 401),
    invalidEmail: () => createSendGridError('Invalid email address', 400),
    rateLimitExceeded: () => createSendGridError('Rate limit exceeded', 429),
    serviceUnavailable: () => createSendGridError('Service unavailable', 503),
};
