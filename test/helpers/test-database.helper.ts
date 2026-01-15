/**
 * Test Database Helper
 * Utilities for managing test database
 */

import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export class TestDatabaseHelper {
    private prisma: PrismaClient;

    constructor() {
        const adapter = new PrismaPg({
            connectionString: process.env.DATABASE_URL,
        });

        this.prisma = new PrismaClient({ adapter });
    }

    /**
     * Connect to test database
     */
    async connect(): Promise<void> {
        await this.prisma.$connect();
    }

    /**
     * Disconnect from test database
     */
    async disconnect(): Promise<void> {
        await this.prisma.$disconnect();
    }

    /**
     * Clear all tables in the test database
     */
    async clearDatabase(): Promise<void> {
        // Delete in correct order to avoid foreign key constraints
        await this.prisma.notification.deleteMany();
        await this.prisma.activity.deleteMany();
        await this.prisma.automationRule.deleteMany();
        await this.prisma.aggregatedSensorReading.deleteMany();
        await this.prisma.sensorReading.deleteMany();
        await this.prisma.plant.deleteMany();
        await this.prisma.rack.deleteMany();
        await this.prisma.user.deleteMany();
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
        return this.prisma.user.create({
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
        return this.prisma.rack.create({
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
        return this.prisma.plant.create({
            data: plantData,
        });
    }

    /**
     * Get Prisma client instance
     */
    getPrismaClient(): PrismaClient {
        return this.prisma;
    }

    /**
     * Run a transaction
     */
    async runTransaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
        return this.prisma.$transaction(async (tx) => fn(tx as PrismaClient));
    }

    /**
     * Check if database is empty
     */
    async isDatabaseEmpty(): Promise<boolean> {
        const userCount = await this.prisma.user.count();
        const rackCount = await this.prisma.rack.count();
        const plantCount = await this.prisma.plant.count();

        return userCount === 0 && rackCount === 0 && plantCount === 0;
    }

    /**
     * Get database statistics
     */
    async getStats() {
        return {
            users: await this.prisma.user.count(),
            racks: await this.prisma.rack.count(),
            plants: await this.prisma.plant.count(),
            activities: await this.prisma.activity.count(),
            notifications: await this.prisma.notification.count(),
        };
    }
}
