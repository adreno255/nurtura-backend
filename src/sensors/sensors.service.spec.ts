import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { AutomationService } from '../automation/automation.service';
import { DeviceStatus } from '../generated/prisma';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MqttMessageParser } from '../common/utils/mqtt-parser.helper';
import {
    createMockAutomationService,
    createMockDatabaseService,
    createMockEventEmitter,
    createMockLogger,
} from '../../test/mocks';

import {
    mockSensorReading,
    mockSensorData,
    mockRack,
    mockReadings,
    mockAggregatedData,
    mockHistory,
    mockStatisticsReadings,
    testRackIds,
    testMacAddresses,
} from '../../test/fixtures';

// Mock MqttMessageParser
jest.mock('../common/utils/mqtt-parser.helper', () => ({
    MqttMessageParser: {
        parseAndValidate: jest.fn(),
    },
}));

describe('SensorsService', () => {
    let service: SensorsService;

    const mockDatabaseService = createMockDatabaseService();
    const mockLogger = createMockLogger();
    const mockAutomationService = createMockAutomationService();
    const mockEventEmitter = createMockEventEmitter();

    const testRackId = testRackIds.primary;
    const testMacAddress = testMacAddresses.valid;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SensorsService,
                {
                    provide: DatabaseService,
                    useValue: mockDatabaseService,
                },
                {
                    provide: AutomationService,
                    useValue: mockAutomationService,
                },
                {
                    provide: EventEmitter2,
                    useValue: mockEventEmitter,
                },
                {
                    provide: MyLoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        service = module.get<SensorsService>(SensorsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getLatestReading', () => {
        it('should retrieve latest sensor reading', async () => {
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue(mockSensorReading);

            const result = await service.getLatestReading(testRackId);

            expect(mockDatabaseService.sensorReading.findFirst).toHaveBeenCalledWith({
                where: { rackId: testRackId },
                orderBy: { timestamp: 'desc' },
            });
            expect(result).toEqual(mockSensorReading);
        });

        it('should log successful retrieval', async () => {
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue(mockSensorReading);

            await service.getLatestReading(testRackId);

            expect(mockLogger.log).toHaveBeenCalledWith(
                `Latest sensor reading retrieved for rack: ${testRackId}`,
                'SensorsService',
            );
        });

        it('should return null when no readings found', async () => {
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue(null);

            const result = await service.getLatestReading(testRackId);

            expect(result).toBeNull();
        });

        it('should log warning when no readings found', async () => {
            mockDatabaseService.sensorReading.findFirst.mockResolvedValue(null);

            await service.getLatestReading(testRackId);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                `No sensor readings found for rack: ${testRackId}`,
                'SensorsService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.sensorReading.findFirst.mockRejectedValue(dbError);

            await expect(service.getLatestReading(testRackId)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.getLatestReading(testRackId)).rejects.toThrow(
                'Failed to retrieve latest sensor reading',
            );
        });

        it('should log error on database failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.sensorReading.findFirst.mockRejectedValue(dbError);

            await expect(service.getLatestReading(testRackId)).rejects.toThrow();

            expect(mockLogger.error).toHaveBeenCalledWith(
                `Failed to get latest reading for rack: ${testRackId}`,
                'Database error',
                'SensorsService',
            );
        });
    });

    describe('getReadings', () => {
        // using shared fixtures imported above

        it('should retrieve readings with default limit', async () => {
            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockReadings);

            const result = await service.getReadings(testRackId);

            expect(mockDatabaseService.sensorReading.findMany).toHaveBeenCalledWith({
                where: { rackId: testRackId },
                orderBy: { timestamp: 'desc' },
                take: 100,
                select: {
                    id: true,
                    temperature: true,
                    humidity: true,
                    moisture: true,
                    lightLevel: true,
                    timestamp: true,
                },
            });
            expect(result).toEqual(mockReadings);
        });

        it('should retrieve readings with date range', async () => {
            const startDate = new Date('2025-02-01T00:00:00.000Z');
            const endDate = new Date('2025-02-02T00:00:00.000Z');

            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockReadings);

            await service.getReadings(testRackId, startDate, endDate);

            expect(mockDatabaseService.sensorReading.findMany).toHaveBeenCalledWith({
                where: {
                    rackId: testRackId,
                    timestamp: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                orderBy: { timestamp: 'desc' },
                take: 100,
                select: expect.any(Object) as object,
            });
        });

        it('should retrieve readings with custom limit', async () => {
            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockReadings);

            await service.getReadings(testRackId, undefined, undefined, 50);

            expect(mockDatabaseService.sensorReading.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 50,
                }),
            );
        });

        it('should retrieve readings with only startDate', async () => {
            const startDate = new Date('2025-02-01T00:00:00.000Z');

            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockReadings);

            await service.getReadings(testRackId, startDate);

            expect(mockDatabaseService.sensorReading.findMany).toHaveBeenCalledWith({
                where: {
                    rackId: testRackId,
                    timestamp: {
                        gte: startDate,
                    },
                },
                orderBy: { timestamp: 'desc' },
                take: 100,
                select: expect.any(Object) as object,
            });
        });

        it('should retrieve readings with only endDate', async () => {
            const endDate = new Date('2025-02-02T00:00:00.000Z');

            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockReadings);

            await service.getReadings(testRackId, undefined, endDate);

            expect(mockDatabaseService.sensorReading.findMany).toHaveBeenCalledWith({
                where: {
                    rackId: testRackId,
                    timestamp: {
                        lte: endDate,
                    },
                },
                orderBy: { timestamp: 'desc' },
                take: 100,
                select: expect.any(Object) as object,
            });
        });

        it('should log successful retrieval', async () => {
            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockReadings);

            await service.getReadings(testRackId);

            expect(mockLogger.log).toHaveBeenCalledWith(
                `Retrieved ${mockReadings.length} sensor readings for rack: ${testRackId}`,
                'SensorsService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.sensorReading.findMany.mockRejectedValue(dbError);

            await expect(service.getReadings(testRackId)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should log error on database failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.sensorReading.findMany.mockRejectedValue(dbError);

            await expect(service.getReadings(testRackId)).rejects.toThrow();

            expect(mockLogger.error).toHaveBeenCalledWith(
                `Failed to get readings for rack: ${testRackId}`,
                'Database error',
                'SensorsService',
            );
        });

        it('should return empty array when no readings found', async () => {
            mockDatabaseService.sensorReading.findMany.mockResolvedValue([]);

            const result = await service.getReadings(testRackId);

            expect(result).toEqual([]);
        });
    });

    describe('getAggregatedData', () => {
        // using shared fixtures imported above

        it('should retrieve aggregated data with default hours', async () => {
            mockDatabaseService.aggregatedSensorReading.findMany.mockResolvedValue(
                mockAggregatedData,
            );

            const result = await service.getAggregatedData(testRackId);

            expect(mockDatabaseService.aggregatedSensorReading.findMany).toHaveBeenCalledWith({
                where: {
                    rackId: testRackId,
                    hour: {
                        gte: expect.any(Date) as Date,
                    },
                },
                orderBy: { hour: 'asc' },
            });
            expect(result).toEqual(mockAggregatedData);
        });

        it('should retrieve aggregated data with custom hours', async () => {
            mockDatabaseService.aggregatedSensorReading.findMany.mockResolvedValue(
                mockAggregatedData,
            );

            await service.getAggregatedData(testRackId, 48);

            // 1. Capture the last call's first argument
            // 2. Cast it to a specific structure instead of 'any' or 'Record'
            const lastCall = mockDatabaseService.aggregatedSensorReading.findMany.mock.lastCall as [
                {
                    where: { hour: { gte: Date } };
                },
            ];

            const callArg = lastCall[0];

            // 3. Now this is 100% type-safe and linter-friendly
            const expectedDate = new Date(Date.now() - 48 * 60 * 60 * 1000);

            expect(callArg.where.hour.gte).toBeInstanceOf(Date);
            expect(callArg.where.hour.gte.getTime()).toBeCloseTo(expectedDate.getTime(), -3);
        });

        it('should log successful retrieval', async () => {
            mockDatabaseService.aggregatedSensorReading.findMany.mockResolvedValue(
                mockAggregatedData,
            );

            await service.getAggregatedData(testRackId);

            expect(mockLogger.log).toHaveBeenCalledWith(
                `Retrieved ${mockAggregatedData.length} aggregated readings for rack ${testRackId}`,
                'SensorsService',
            );
        });

        it('should propagate database errors', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.aggregatedSensorReading.findMany.mockRejectedValue(dbError);

            await expect(service.getAggregatedData(testRackId)).rejects.toThrow('Database error');
        });

        it('should log error on database failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.aggregatedSensorReading.findMany.mockRejectedValue(dbError);

            await expect(service.getAggregatedData(testRackId)).rejects.toThrow();

            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error fetching aggregated sensor data for rack: ${testRackId}`,
                'Database error',
                'SensorsService',
            );
        });
    });

    describe('getHistory', () => {
        // using shared fixtures imported above

        it('should retrieve history with default hours', async () => {
            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockHistory);

            const result = await service.getHistory(testRackId);

            expect(mockDatabaseService.sensorReading.findMany).toHaveBeenCalledWith({
                where: {
                    rackId: testRackId,
                    timestamp: {
                        gte: expect.any(Date) as Date,
                    },
                },
                orderBy: { timestamp: 'asc' },
            });
            expect(result).toEqual(mockHistory);
        });

        it('should retrieve history with custom hours', async () => {
            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockHistory);

            const hours = 48;
            await service.getHistory(testRackId, hours);

            const expectedDate = new Date(Date.now() - hours * 60 * 60 * 1000);

            // Cast the arguments of the last call to the expected shape
            const [callArg] = mockDatabaseService.sensorReading.findMany.mock.lastCall as [
                {
                    where: { timestamp: { gte: Date } };
                },
            ];

            expect(callArg.where.timestamp.gte.getTime()).toBeCloseTo(expectedDate.getTime(), -3);
        });

        it('should log successful retrieval', async () => {
            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockHistory);

            await service.getHistory(testRackId, 24);

            expect(mockLogger.log).toHaveBeenCalledWith(
                `Retrieved ${mockHistory.length} sensor readings for rack ${testRackId} (last 24h)`,
                'SensorsService',
            );
        });

        it('should propagate database errors', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.sensorReading.findMany.mockRejectedValue(dbError);

            await expect(service.getHistory(testRackId)).rejects.toThrow('Database error');
        });

        it('should log error on database failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.sensorReading.findMany.mockRejectedValue(dbError);

            await expect(service.getHistory(testRackId)).rejects.toThrow();

            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error fetching history for rack: ${testRackId}`,
                'Database error',
                'SensorsService',
            );
        });
    });

    describe('getStatistics', () => {
        // statistics-specific readings imported from fixtures
        const mockReadings = mockStatisticsReadings;

        it('should calculate statistics from history', async () => {
            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockReadings);

            const result = await service.getStatistics(testRackId);

            expect(result).toBeDefined();
            expect(result?.temperature).toBeDefined();
            expect(result?.humidity).toBeDefined();
            expect(result?.moisture).toBeDefined();
            expect(result?.lightLevel).toBeDefined();
            expect(result?.totalReadings).toBe(3);
            expect(result?.periodHours).toBe(24);
        });

        it('should calculate correct temperature statistics', async () => {
            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockReadings);

            const result = await service.getStatistics(testRackId);

            expect(result?.temperature).toEqual({
                min: 24.0,
                max: 26.0,
                avg: 25.0,
                median: 25.0,
                count: 3,
            });
        });

        it('should calculate correct humidity statistics', async () => {
            mockDatabaseService.sensorReading.findMany.mockResolvedValue(mockReadings);

            const result = await service.getStatistics(testRackId);

            expect(result?.humidity).toEqual({
                min: 60.0,
                max: 70.0,
                avg: 65.0,
                median: 65.0,
                count: 3,
            });
        });

        it('should return null when no readings available', async () => {
            mockDatabaseService.sensorReading.findMany.mockResolvedValue([]);

            const result = await service.getStatistics(testRackId);

            expect(result).toBeNull();
        });

        it('should propagate database errors', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.sensorReading.findMany.mockRejectedValue(dbError);

            await expect(service.getStatistics(testRackId)).rejects.toThrow('Database error');
        });

        it('should log error on failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.sensorReading.findMany.mockRejectedValue(dbError);

            await expect(service.getStatistics(testRackId)).rejects.toThrow();

            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error calculating statistics for rack: ${testRackId}`,
                'Database error',
                'SensorsService',
            );
        });
    });

    describe('processSensorData', () => {
        const rawMessage = JSON.stringify(mockSensorData);

        beforeEach(() => {
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(mockSensorData);
        });

        it('should log processing start', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockResolvedValue(mockSensorReading);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processSensorData(testMacAddress, rawMessage);

            expect(mockLogger.log).toHaveBeenCalledWith(
                `Processing sensor data from device: ${testMacAddress}`,
                'SensorsService',
            );
        });

        it('should parse and validate message', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockResolvedValue(mockSensorReading);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processSensorData(testMacAddress, rawMessage);

            expect(jest.spyOn(MqttMessageParser, 'parseAndValidate')).toHaveBeenCalledWith(
                rawMessage,
                expect.anything(),
                testMacAddress,
            );
        });

        it('should find rack by MAC address', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockResolvedValue(mockSensorReading);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processSensorData(testMacAddress, rawMessage);

            expect(mockDatabaseService.rack.findUnique).toHaveBeenCalledWith({
                where: { macAddress: testMacAddress },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                        },
                    },
                },
            });
        });

        it('should throw BadRequestException for unregistered device', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);

            await expect(service.processSensorData(testMacAddress, rawMessage)).rejects.toThrow(
                BadRequestException,
            );
            await expect(service.processSensorData(testMacAddress, rawMessage)).rejects.toThrow(
                `Device with MAC address ${testMacAddress} is not registered`,
            );
        });

        it('should log warning for unregistered device', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(null);

            await expect(service.processSensorData(testMacAddress, rawMessage)).rejects.toThrow();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                `Received sensor data from unregistered device: ${testMacAddress}`,
                'SensorsService',
            );
        });

        it('should save sensor reading to database', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockResolvedValue(mockSensorReading);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processSensorData(testMacAddress, rawMessage);

            expect(mockDatabaseService.sensorReading.create).toHaveBeenCalledWith({
                data: {
                    rackId: mockRack.id,
                    temperature: mockSensorData.temperature,
                    humidity: mockSensorData.humidity,
                    moisture: mockSensorData.moisture,
                    lightLevel: mockSensorData.lightLevel,
                    timestamp: expect.any(Date) as Date,
                    rawData: mockSensorData,
                },
            });
        });

        it('should log sensor reading saved', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockResolvedValue(mockSensorReading);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processSensorData(testMacAddress, rawMessage);

            expect(mockLogger.log).toHaveBeenCalledWith(
                expect.stringContaining(`Sensor reading saved for rack ${mockRack.name}`),
                'SensorsService',
            );
        });

        it('should update rack status to ONLINE', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockResolvedValue(mockSensorReading);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processSensorData(testMacAddress, rawMessage);

            expect(mockDatabaseService.rack.update).toHaveBeenCalledWith({
                where: { id: mockRack.id },
                data: {
                    lastActivityAt: expect.any(Date) as Date,
                    lastSeenAt: expect.any(Date) as Date,
                    status: DeviceStatus.ONLINE,
                },
            });
        });

        it('should broadcast sensor data via event emitter', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockResolvedValue(mockSensorReading);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processSensorData(testMacAddress, rawMessage);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'broadcastSensorData',
                mockRack.id,
                mockSensorReading,
            );
        });

        it('should evaluate automation rules', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockResolvedValue(mockSensorReading);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processSensorData(testMacAddress, rawMessage);

            expect(mockAutomationService.evaluateRules).toHaveBeenCalledWith(
                mockRack.id,
                mockSensorData,
            );
        });

        it('should log processing complete', async () => {
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockResolvedValue(mockSensorReading);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processSensorData(testMacAddress, rawMessage);

            expect(mockLogger.log).toHaveBeenCalledWith(
                `Processing complete for rack: ${mockRack.id}`,
                'SensorsService',
            );
        });

        it('should throw InternalServerErrorException on database save error', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockRejectedValue(dbError);

            await expect(service.processSensorData(testMacAddress, rawMessage)).rejects.toThrow(
                InternalServerErrorException,
            );
        });

        it('should log error on processing failure', async () => {
            const dbError = new Error('Database error');
            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockRejectedValue(dbError);

            await expect(service.processSensorData(testMacAddress, rawMessage)).rejects.toThrow();

            expect(mockLogger.error).toHaveBeenCalledWith(
                `Failed to process sensor data for device: ${testMacAddress}`,
                'Database error',
                'SensorsService',
            );
        });

        it('should handle sensor data without timestamp', async () => {
            const dataWithoutTimestamp = { ...mockSensorData, timestamp: undefined };
            (MqttMessageParser.parseAndValidate as jest.Mock).mockResolvedValue(
                dataWithoutTimestamp,
            );

            mockDatabaseService.rack.findUnique.mockResolvedValue(mockRack);
            mockDatabaseService.sensorReading.create.mockResolvedValue(mockSensorReading);
            mockDatabaseService.rack.update.mockResolvedValue(mockRack);

            await service.processSensorData(testMacAddress, rawMessage);

            // Cast to capture the 'data' property shape
            const [createCall] = mockDatabaseService.sensorReading.create.mock.lastCall as [
                {
                    data: { timestamp: Date };
                },
            ];

            expect(createCall.data.timestamp).toBeInstanceOf(Date);
        });
    });
});
