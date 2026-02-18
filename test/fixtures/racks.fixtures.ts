/**
 * Rack Test Fixtures
 * Reusable data for rack-related tests
 */

import { DeviceStatus } from '../../src/generated/prisma';
import type { CreateRackDto } from '../../src/racks/dto/create-rack.dto';
import type { UpdateRackDto } from '../../src/racks/dto/update-rack.dto';
import { ActivityEventType } from '../../src/generated/prisma';

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
export const mockActivity = {
    id: 'activity-101',
    rackId: testRackIds.primary,
    eventType: ActivityEventType.DEVICE_ONLINE,
    details: 'Device came online',
    timestamp: new Date('2025-02-01T10:30:00.000Z'),
    metadata: {},
    createdAt: new Date('2025-02-01T10:30:00.000Z'),
};

// Sample raw status message from device (used by service tests)
export const statusMessage = JSON.stringify({ o: true, tm: Date.now() });
