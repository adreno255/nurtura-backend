/**
 * Database Mock Utilities
 * Reusable mocks for Prisma DatabaseService
 */

export const createMockDatabaseService = () => ({
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    },
    rack: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    },
    plant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    },
    activity: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    },
    notification: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    },
    sensorReading: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    },
    aggregatedSensorReading: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    },
    automationRule: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
});

/**
 * Mock Prisma Errors
 */
export const createPrismaError = (code: string, message: string) => {
    return Object.assign(new Error(message), {
        code,
    });
};

/**
 * Common Prisma Error Presets
 */
export const PrismaErrors = {
    uniqueConstraint: () => createPrismaError('P2002', 'Unique constraint failed'),
    recordNotFound: () => createPrismaError('P2025', 'Record not found'),
    foreignKeyConstraint: () => createPrismaError('P2003', 'Foreign key constraint failed'),
    connectionError: () => createPrismaError('P1001', 'Cannot reach database server'),
};
