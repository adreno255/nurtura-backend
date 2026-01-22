/**
 * Test Database Helper
 * Utilities for managing test database
 */

import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export class TestDatabaseHelper extends PrismaClient {
    private pool: Pool;

    constructor(connectionString?: string) {
        const url = connectionString || process.env.DATABASE_URL;

        const pool = new Pool({ connectionString: url });
        const adapter = new PrismaPg(pool);

        super({ adapter });
        this.pool = pool;
    }

    /**
     * Connect to test database
     */
    async connect(): Promise<void> {
        await this.$connect();
    }

    /**
     * Disconnect from test database
     */
    async disconnect(): Promise<void> {
        await this.$disconnect();
        await this.pool.end();
    }

    /**
     * Clear all tables in the test database
     */
    async clearDatabase(): Promise<void> {
        // Delete in correct order to avoid foreign key constraints
        await this.notification.deleteMany();
        await this.activity.deleteMany();
        await this.automationRule.deleteMany();
        await this.aggregatedSensorReading.deleteMany();
        await this.sensorReading.deleteMany();
        await this.plant.deleteMany();
        await this.rack.deleteMany();
        await this.user.deleteMany();
    }

    /**
     * Seed a test user
     */
    async seedUser(userData: {
        firebaseUid: string;
        email: string;
        firstName: string;
        middleName?: string | null;
        lastName: string;
        suffix?: string | null;
        address: string;
    }) {
        return this.user.create({
            data: userData,
        });
    }

    /**
     * Seed a test rack
     */
    async seedRack(rackData: {
        userId: string;
        name: string;
        macAddress: string;
        description?: string | null;
    }) {
        return this.rack.create({
            data: rackData,
        });
    }

    /**
     * Seed a test plant
     */
    async seedPlant(plantData: {
        rackId: string;
        name: string;
        type?: any;
        quantity?: number;
        recommendedSoil?: any;
    }) {
        return this.plant.create({
            data: plantData,
        });
    }

    /**
     * Get Prisma client instance
     */
    getPrismaClient(): PrismaClient {
        return this;
    }

    /**
     * Run a transaction
     */
    async runTransaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
        return this.$transaction(async (tx) => fn(tx as PrismaClient));
    }

    /**
     * Check if database is empty
     */
    async isDatabaseEmpty(): Promise<boolean> {
        const userCount = await this.user.count();
        const rackCount = await this.rack.count();
        const plantCount = await this.plant.count();

        return userCount === 0 && rackCount === 0 && plantCount === 0;
    }

    /**
     * Get database statistics
     */
    async getStats() {
        return {
            users: await this.user.count(),
            racks: await this.rack.count(),
            plants: await this.plant.count(),
            activities: await this.activity.count(),
            notifications: await this.notification.count(),
        };
    }
}
