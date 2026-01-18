/**
 * ConfigService Mock Utilities
 * Reusable mocks for NestJS ConfigService
 */

/**
 * Default configuration values for testing
 */
export const defaultTestConfig = {
    NODE_ENV: 'test',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/nurtura_test',
    SENDGRID_API_KEY: 'SG.test-api-key',
    SENDGRID_FROM_EMAIL: 'noreply@nurtura.test',
    SENDGRID_FROM_NAME: 'Nurtura Test',
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
        type: 'service_account',
        project_id: 'nurtura-api-test',
        private_key_id: 'a1b2c3d4e5f6g7h8i9j0',
        private_key:
            '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDC8...\n...morekey...\n-----END PRIVATE KEY-----\n',
        client_email: 'firebase-adminsdk@nurtura-api-test.iam.gserviceaccount.com',
        client_id: '12345678901234567890',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url:
            'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40nurtura-api-test.iam.gserviceaccount.com',
        universe_domain: 'googleapis.com',
    }),
};

/**
 * Create a mock ConfigService with custom config
 */
export const createMockConfigService = (config: Partial<typeof defaultTestConfig> = {}) => {
    const fullConfig = { ...defaultTestConfig, ...config };

    return {
        get: jest.fn((key: string) => fullConfig[key as keyof typeof fullConfig]),
    };
};
