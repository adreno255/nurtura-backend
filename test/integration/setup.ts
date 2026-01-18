import { config } from 'dotenv';
import { TestDatabaseHelper } from '../helpers/test-database.helper';
import { inputUser } from '../fixtures';

/**
 * Global setup for integration tests
 * Runs ONCE before all integration tests
 */
export default async function globalSetup() {
    console.log('\nStarting integration test setup...\n');

    config({ path: '.env.test' });

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

        await dbHelper.seedUser(inputUser);
        console.log('Test database seeded');
    } catch (error) {
        console.error('Failed to initialize test database:', error);
        throw error;
    } finally {
        await dbHelper.disconnect();
        console.log('Disconnected from test database');
    }

    console.log('\nIntegration test setup complete!\n');
}
