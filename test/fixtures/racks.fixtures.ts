/**
 * Rack Test Fixtures
 * Reusable data for rack-related tests
 */

import { DeviceStatus, PlantCategory, SoilType } from '../../src/generated/prisma';
import type { CreateRackDto } from '../../src/racks/dto/create-rack.dto';
import type { UpdateRackDto } from '../../src/racks/dto/update-rack.dto';
import { ActivityEventType } from '../../src/generated/prisma';
import { type AssignPlantToRackDto, type UpdatePlantDto } from '../../src/plants/dto';
import { testPlantIds } from './plants.fixtures';
import { type ActivityQueryDto } from '../../src/common/dto/activity-query.dto';

/**
 * Base rack used by many sensor tests
 */
export const mockRack = {
    id: 'rack-123',
    userId: 'user-123',
    name: 'Test Rack',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    description: 'Test rack description',
    isActive: true,
    status: DeviceStatus.ONLINE,
    lastActivityAt: new Date(),
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    mqttTopic: null,
    user: {
        id: 'user-123',
        email: 'test@example.com',
    },
};

/**
 * Common test rack IDs
 */
export const testRackIds = {
    primary: 'rack-123',
    secondary: 'rack-456',
    unauthorized: 'rack-999',
};

/**
 * Common test rack MAC Addresses
 */
export const testMacAddresses = {
    valid: 'AA:BB:CC:DD:EE:FF',
    alternative: '11:22:33:44:55:66',
    invalid: 'invalid-mac',
};

export const validCreateRackDto: CreateRackDto = {
    name: 'Test Rack',
    macAddress: testMacAddresses.valid,
    mqttTopic: 'nurtura/rack/test-rack',
    description: 'A rack used in tests',
};

export const validUpdateRackDto: UpdateRackDto = {
    name: 'Updated Test Rack',
    mqttTopic: 'nurtura/rack/updated',
    description: 'Updated description for tests',
};

// Collection of racks for list-based tests
export const mockRacks = [
    mockRack,
    {
        ...mockRack,
        id: testRackIds.secondary,
        macAddress: testMacAddresses.alternative,
        userId: 'user-456',
        mqttTopic: 'nurtura/rack/secondary',
    },
];

// Sample activity object representing a rack event
// export const mockActivity = {
//     id: 'activity-101',
//     rackId: testRackIds.primary,
//     eventType: ActivityEventType.DEVICE_ONLINE,
//     details: 'Device came online',
//     timestamp: new Date('2025-02-01T10:30:00.000Z'),
//     metadata: {},
//     createdAt: new Date('2025-02-01T10:30:00.000Z'),
// };

// Sample raw status message from device (used by service tests)
export const statusMessage = JSON.stringify({ o: true, tm: Date.now() });

// ActivityQueryDto shapes used across all four suites
export const baseActivityQuery: ActivityQueryDto = { page: 1, limit: 10 };
export const filteredActivityQuery: ActivityQueryDto = {
    page: 1,
    limit: 10,
    rackId: [testRackIds.primary],
    startDate: '2024-01-01',
    endDate: '2024-12-31',
};

// Minimal activity records (eventType is irrelevant to pagination shape)
export const mockActivity = {
    id: 'activity-1',
    rackId: testRackIds.primary,
    eventType: ActivityEventType.RACK_ADDED,
    description: 'Test activity',
    metadata: {},
    timestamp: new Date('2024-06-15'),
};
export const mockActivities = [mockActivity];

// Expected paginated response wrapper
export const expectedPaginatedResponse = {
    data: mockActivities,
    meta: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
    },
};

export const deactivatePlantDto: UpdatePlantDto = {
    isActive: false,
};

export const validAssignPlantToRackDto: AssignPlantToRackDto = {
    plantId: 'clx000plant123',
    quantity: 10,
};

export const assignWithDateDto: AssignPlantToRackDto = {
    plantId: 'clx000plant123',
    quantity: 5,
    plantedAt: '2026-02-26T08:00:00.000Z',
};

// ─────────────────────────────────────────────
// RACK STATE (for assignment tests)
// ─────────────────────────────────────────────

export const emptyRackForPlant = {
    id: 'rack-123',
    userId: 'user-123',
    currentPlantId: null,
    quantity: 0,
    plantedAt: null,
    harvestCount: 0,
    lastHarvestAt: null,
    currentPlant: null,
};

export const rackWithPlant = {
    ...emptyRackForPlant,
    currentPlantId: testPlantIds.primary,
    quantity: 10,
    plantedAt: new Date('2026-01-01T08:00:00.000Z'),
    currentPlant: { name: 'Lettuce' },
};

export const rackWithDifferentPlant = {
    ...emptyRackForPlant,
    currentPlantId: testPlantIds.secondary,
    quantity: 5,
    plantedAt: new Date('2026-01-10T08:00:00.000Z'),
    currentPlant: { name: 'Basil' },
};

// ─────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────

export const mockRackPlantingHistoryEntry = {
    id: 'history-001',
    rackId: 'rack-123',
    plantId: testPlantIds.primary,
    quantity: 10,
    plantedAt: new Date('2026-01-01T08:00:00.000Z'),
    harvestedAt: new Date('2026-02-01T08:00:00.000Z'),
    harvestCount: 1,
    createdAt: new Date('2026-01-01T08:00:00.000Z'),
    updatedAt: new Date('2026-02-01T08:00:00.000Z'),
    plant: {
        id: testPlantIds.primary,
        name: 'Lettuce',
        category: PlantCategory.LEAFY_GREENS,
        recommendedSoil: SoilType.LOAMY,
    },
};

export const mockOpenRackPlantingHistoryEntry = {
    ...mockRackPlantingHistoryEntry,
    id: 'history-002',
    harvestedAt: null,
    harvestCount: 0,
};

export const mockRackPlantingHistory = [
    mockRackPlantingHistoryEntry,
    mockOpenRackPlantingHistoryEntry,
];

export const paginatedHistoryResponse = {
    data: mockRackPlantingHistory,
    meta: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: mockRackPlantingHistory.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
    },
};

export const assignSuccessResponse = {
    message: 'Plant assigned to rack successfully',
};

export const unassignFromRackSuccessResponse = {
    message: 'Plant removed from rack successfully',
};

export const harvestSuccessResponse = {
    message: 'Plant harvested successfully',
};
