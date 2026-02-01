/**
 * Test Data Helper
 * Utilities for generating test data
 * Can be used in unit, integration, and E2E tests
 */

import * as admin from 'firebase-admin';
import { type DecodedIdToken } from 'firebase-admin/auth';

export class TestDataHelper {
    private static firebaseInitialized = false;

    /**
     * Initialize Firebase Admin SDK for testing
     * @private
     */
    private static initializeFirebase(): void {
        if (this.firebaseInitialized) {
            return;
        }

        try {
            const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
            if (!serviceAccountJson) {
                throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable not set');
            }

            const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });

            this.firebaseInitialized = true;
        } catch (error) {
            console.error('Failed to initialize Firebase for testing:', error);
            throw error;
        }
    }

    /**
     * Create a Firebase test user
     * Used for E2E tests that require real Firebase authentication
     */
    static async createFirebaseTestUser(email: string): Promise<{
        firebaseUid: string;
        email: string;
    }> {
        this.initializeFirebase();

        const password = this.generateStrongPassword();

        try {
            // Create user in Firebase
            const userRecord = await admin.auth().createUser({
                email,
                password,
                emailVerified: true,
            });

            return {
                firebaseUid: userRecord.uid,
                email: userRecord.email!,
            };
        } catch (error) {
            console.error('Failed to create Firebase test user:', error);
            throw error;
        }
    }

    /**
     * Create mock authentication token
     * Used for E2E tests that require authentication
     */
    static createMockDecodedToken(overrides: Partial<DecodedIdToken>): DecodedIdToken {
        return {
            uid: 'default-uid',
            email: 'test@example.com',
            email_verified: true,
            iss: 'https://securetoken.google.com/your-project',
            aud: 'your-project',
            auth_time: 123,
            iat: 123,
            exp: 456,
            sub: 'default-uid',
            firebase: { identities: {}, sign_in_provider: 'password' },
            ...overrides,
        } as DecodedIdToken;
    }

    /**
     * Delete a Firebase test user
     * Used to clean up after E2E tests
     */
    static async deleteFirebaseTestUser(uid: string): Promise<void> {
        this.initializeFirebase();

        try {
            await admin.auth().deleteUser(uid);
        } catch (error) {
            // Ignore errors if user doesn't exist
            if (error instanceof Error && !error.message.includes('NOT_FOUND')) {
                console.error('Failed to delete Firebase test user:', error);
            }
        }
    }

    /**
     * Generate a random email address
     */
    static generateRandomEmail(): string {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `test${timestamp}${random}@example.com`;
    }

    /**
     * Generate a valid 5-digit OTP code
     */
    static generateValidOtp(): string {
        return Math.floor(10000 + Math.random() * 90000).toString();
    }

    /**
     * Generate a random Firebase UID
     */
    static generateFirebaseUid(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 9);
        return `uid_${timestamp}_${random}`;
    }

    /**
     * Generate a random MAC address
     */
    static generateMacAddress(): string {
        const hexDigits = '0123456789ABCDEF';
        const octets: string[] = [];

        for (let i = 0; i < 6; i++) {
            const octet =
                hexDigits.charAt(Math.floor(Math.random() * 16)) +
                hexDigits.charAt(Math.floor(Math.random() * 16));
            octets.push(octet);
        }

        return octets.join(':');
    }

    /**
     * Generate a random strong password
     */
    static generateStrongPassword(): string {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const digits = '0123456789';
        const special = '!@#$%^&*';

        const password =
            uppercase.charAt(Math.floor(Math.random() * uppercase.length)) +
            lowercase.charAt(Math.floor(Math.random() * lowercase.length)) +
            digits.charAt(Math.floor(Math.random() * digits.length)) +
            special.charAt(Math.floor(Math.random() * special.length)) +
            Math.random().toString(36).substring(2, 8);

        return password;
    }

    /**
     * Generate a random CUID (similar to Prisma's cuid())
     */
    static generateCuid(): string {
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substring(2, 15);
        return `c${timestamp}${randomPart}`;
    }

    /**
     * Generate a future date (for expiry times)
     */
    static generateFutureDate(minutesFromNow: number): Date {
        return new Date(Date.now() + minutesFromNow * 60 * 1000);
    }

    /**
     * Generate a past date (for expired items)
     */
    static generatePastDate(minutesAgo: number): Date {
        return new Date(Date.now() - minutesAgo * 60 * 1000);
    }

    /**
     * Generate random user data
     */
    static generateUserData() {
        const firstNames = ['John', 'Jane', 'Alice', 'Bob', 'Charlie', 'Diana'];
        const middleNames = ['Michael', 'Marie', 'James', 'Ann', 'Lee', 'Rose'];
        const lastNames = ['Doe', 'Smith', 'Johnson', 'Williams', 'Brown', 'Garcia'];
        const suffixes = ['Jr.', 'Sr.', 'III', 'IV'];
        const streets = ['Main St', 'Oak Ave', 'Pine Rd', 'Maple Dr', 'Cedar Ln'];
        const barangays = ['Brgy Commonwealth', 'Brgy Test', 'Brgy Sample', 'Brgy Example'];
        const cities = ['Quezon City', 'Manila', 'Makati', 'Pasig', 'Taguig'];

        // 30% chance to have middleName
        const middleName =
            Math.random() > 0.7
                ? middleNames[Math.floor(Math.random() * middleNames.length)]
                : undefined;

        // 20% chance to have suffix
        const suffix =
            Math.random() > 0.8 ? suffixes[Math.floor(Math.random() * suffixes.length)] : undefined;

        return {
            firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
            middleName,
            lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
            suffix,
            block: `Block ${Math.floor(Math.random() * 20) + 1}`,
            street: streets[Math.floor(Math.random() * streets.length)],
            barangay: barangays[Math.floor(Math.random() * barangays.length)],
            city: cities[Math.floor(Math.random() * cities.length)],
        };
    }

    /**
     * Generate random rack name
     */
    static generateRackName(): string {
        const adjectives = ['Smart', 'Green', 'Urban', 'Modern', 'Eco'];
        const nouns = ['Farm', 'Garden', 'Rack', 'System', 'Setup'];

        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = Math.floor(Math.random() * 100) + 1;

        return `${adjective} ${noun} ${number}`;
    }

    /**
     * Delay execution (useful for testing timeouts)
     */
    static async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Check if string is a valid email
     */
    static isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Check if string is a valid OTP (5 digits)
     */
    static isValidOtp(otp: string): boolean {
        return /^\d{5}$/.test(otp);
    }

    /**
     * Generate random sensor reading data
     */
    static generateSensorData() {
        return {
            temperature: Number((20 + Math.random() * 15).toFixed(2)), // 20-35°C
            humidity: Number((40 + Math.random() * 40).toFixed(2)), // 40-80%
            moisture: Number((30 + Math.random() * 50).toFixed(2)), // 30-80%
            lightLevel: Number((200 + Math.random() * 800).toFixed(2)), // 200-1000 lux
        };
    }

    /**
     * Generate random plant data
     */
    static generatePlantData() {
        const plantNames = ['Lettuce', 'Basil', 'Mint', 'Parsley', 'Spinach', 'Celery'];
        const plantTypes = ['ASTERACEAE', 'LAMIACEAE', 'BASELLACEAE', 'APIACEAE'];
        const soilTypes = ['LOAMY', 'SANDY', 'PEATY', 'SILTY'];

        return {
            name: plantNames[Math.floor(Math.random() * plantNames.length)],
            type: plantTypes[Math.floor(Math.random() * plantTypes.length)],
            quantity: Math.floor(Math.random() * 10) + 1,
            recommendedSoil: soilTypes[Math.floor(Math.random() * soilTypes.length)],
            notes: `Test plant notes ${Math.random().toString(36).substring(7)}`,
        };
    }

    /**
     * Generate ISO timestamp string
     */
    static generateIsoTimestamp(date?: Date): string {
        return (date || new Date()).toISOString();
    }

    /**
     * Generate random rack data
     */
    static generateRackData() {
        return {
            name: this.generateRackName(),
            macAddress: this.generateMacAddress(),
            description: `Test rack description ${Math.random().toString(36).substring(7)}`,
            isActive: Math.random() > 0.2, // 80% active
        };
    }

    /**
     * Wait for condition (useful for async tests)
     */
    static async waitFor(
        condition: () => boolean,
        timeoutMs: number = 5000,
        intervalMs: number = 100,
    ): Promise<void> {
        const startTime = Date.now();

        while (!condition()) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error('Timeout waiting for condition');
            }
            await this.delay(intervalMs);
        }
    }

    /**
     * Create a mock Date.now() that returns a fixed timestamp
     */
    static mockDateNow(fixedTimestamp?: number): jest.SpyInstance {
        const timestamp = fixedTimestamp || Date.now();
        return jest.spyOn(Date, 'now').mockReturnValue(timestamp);
    }

    /**
     * Restore Date.now() to original implementation
     */
    static restoreDateNow(): void {
        jest.spyOn(Date, 'now').mockRestore();
    }
}
