/**
 * Sensors Test Fixtures
 * Reusable data objects for sensor-related service and controller tests
 */

import { type SensorReading } from '../../src/generated/prisma';

/**
 * Mock sensor reading
 */
export const mockSensorReading: SensorReading = {
    id: 'reading-123',
    rackId: 'rack-123',
    temperature: 25.5,
    humidity: 65.0,
    moisture: 45.0,
    lightLevel: 800.0,
    waterUsed: 200.0,
    timestamp: new Date('2026-01-15T10:30:00.000Z'),
    rawData: null,
};

/**
 * Alternative sensor reading
 */
export const alternativeSensorReading: SensorReading = {
    id: 'reading-456',
    rackId: 'rack-456',
    temperature: 22.0,
    humidity: 70.0,
    moisture: 50.0,
    lightLevel: 750.0,
    waterUsed: 100.0,
    timestamp: new Date('2026-01-15T11:00:00.000Z'),
    rawData: null,
};

// Raw sensor data coming from the device (before storage)
export const mockSensorData = {
    temperature: 25.5,
    humidity: 65.2,
    moisture: 45.8,
    lightLevel: 850,
    waterUsed: 100.0,
    timestamp: '2025-02-01T10:00:00.000Z',
};

// Simple array of two readings for list tests
export const mockReadings = [
    {
        id: 'reading-1',
        temperature: 25.5,
        humidity: 65.2,
        moisture: 45.8,
        lightLevel: 850,
        waterUsed: 100.0,
        timestamp: new Date('2025-02-01T10:00:00.000Z'),
    },
    {
        id: 'reading-2',
        temperature: 26.0,
        humidity: 66.0,
        moisture: 46.0,
        lightLevel: 900,
        waterUsed: 150.0,
        timestamp: new Date('2025-02-01T11:00:00.000Z'),
    },
];

// Aggregated data samples for aggregation tests
export const mockAggregatedData = [
    {
        id: 'agg-1',
        rackId: 'rack-123',
        hour: new Date('2025-02-01T10:00:00.000Z'),
        avgTemperature: 25.5,
        avgHumidity: 65.2,
        avgMoisture: 45.8,
        avgLightLevel: 850,
        minTemperature: 24.0,
        maxTemperature: 27.0,
        minMoisture: 40.0,
        maxMoisture: 50.0,
        readingCount: 60,
        createdAt: new Date(),
    },
];

// History fixture simply referencing a single reading
export const mockHistory = [mockSensorReading];

// Sample readings used for statistics calculations
export const mockStatisticsReadings = [
    {
        ...mockSensorReading,
        temperature: 24.0,
        humidity: 60.0,
        moisture: 40.0,
        lightLevel: 500,
        waterUsed: 100.0,
    },
    {
        ...mockSensorReading,
        temperature: 25.0,
        humidity: 65.0,
        moisture: 45.0,
        lightLevel: 750,
    },
    {
        ...mockSensorReading,
        temperature: 26.0,
        humidity: 70.0,
        moisture: 50.0,
        lightLevel: 1000,
        waterUsed: 200.0,
    },
];

// Precomputed statistics for controller expectations
export const mockStatistics = {
    temperature: {
        min: 22.0,
        max: 28.0,
        avg: 25.5,
        median: 25.0,
        count: 48,
    },
    humidity: {
        min: 60.0,
        max: 70.0,
        avg: 65.2,
        median: 65.0,
        count: 48,
    },
    moisture: {
        min: 40.0,
        max: 50.0,
        avg: 45.8,
        median: 46.0,
        count: 48,
    },
    lightLevel: {
        min: 500,
        max: 1200,
        avg: 850,
        median: 800,
        count: 48,
    },
    totalReadings: 48,
    periodHours: 24,
};
