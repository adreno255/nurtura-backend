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
        project_id: 'test-project',
        private_key_id: 'test-key-id',
        private_key: 'test-private-key',
        client_email: 'test@test-project.iam.gserviceaccount.com',
        client_id: 'test-client-id',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url:
            'https://www.googleapis.com/robot/v1/metadata/x509/test.iam.gserviceaccount.com',
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
