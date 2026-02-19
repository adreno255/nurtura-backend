import { config } from 'dotenv';
import { TestDatabaseHelper } from '../helpers/test-database.helper';

/**
 * Global setup for E2E tests
 * Runs ONCE before all E2E tests
 */
export default async function globalSetup() {
    console.log('\nStarting E2E test setup...\n');

    config({ path: '.env.staging' });

    const requiredEnvVars = [
        'DATABASE_URL',
        'FIREBASE_SERVICE_ACCOUNT',
        'SENDGRID_API_KEY',
        'SENDGRID_FROM_EMAIL',
        'SENDGRID_FROM_NAME',
    ];

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
        throw new Error(
            `Missing required environment variables in .env.test: ${missingVars.join(', ')}`,
        );
    }

    console.log('Environment variables loaded');

    const dbHelper = new TestDatabaseHelper();

    try {
        await dbHelper.connect();
        console.log('Connected to test database');

        // Reset database to clean state
        await dbHelper.clearDatabase();
        console.log('Test database reset to clean state');
    } catch (error) {
        console.error('Failed to initialize test database:', error);
        throw error;
    } finally {
        await dbHelper.disconnect();
        console.log('Disconnected from test database');
    }

    console.log('\nE2E test setup complete!\n');
    console.log('Note: Each E2E test will start a full NestJS application\n');
}
