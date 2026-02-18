import { Test, type TestingModule } from '@nestjs/testing';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';
import { RacksService } from '../racks/racks.service';
import {
    mockSensorReading,
    mockReadings,
    mockAggregatedData,
    mockStatistics,
    testUser,
    testRackIds,
} from '../../test/fixtures';
import { createMockRacksService, createMockSensorsService } from '../../test/mocks';

describe('SensorsController', () => {
    let controller: SensorsController;

    const mockSensorsService = createMockSensorsService();

    const mockRacksService = createMockRacksService();

    const testRackId = testRackIds.primary;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [SensorsController],
            providers: [
                {
                    provide: SensorsService,
                    useValue: mockSensorsService,
                },
                {
                    provide: RacksService,
                    useValue: mockRacksService,
                },
            ],
        }).compile();

        controller = module.get<SensorsController>(SensorsController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getLatestReading', () => {
        it('should retrieve latest sensor reading', async () => {
            mockSensorsService.getLatestReading.mockResolvedValue(mockSensorReading);

            const result = await controller.getLatestReading(testRackId);

            expect(mockSensorsService.getLatestReading).toHaveBeenCalledWith(testRackId);
            expect(result).toEqual(mockSensorReading);
        });

        it('should call SensorsService.getLatestReading once', async () => {
            mockSensorsService.getLatestReading.mockResolvedValue(mockSensorReading);

            await controller.getLatestReading(testRackId);

            expect(mockSensorsService.getLatestReading).toHaveBeenCalledTimes(1);
        });

        it('should return null when no readings found', async () => {
            mockSensorsService.getLatestReading.mockResolvedValue(null);

            const result = await controller.getLatestReading(testRackId);

            expect(result).toBeNull();
        });

        it('should propagate service errors', async () => {
            const serviceError = new Error('Service error');
            mockSensorsService.getLatestReading.mockRejectedValue(serviceError);

            await expect(controller.getLatestReading(testRackId)).rejects.toThrow('Service error');
        });

        it('should work with different rack IDs', async () => {
            const rackIds = ['rack-1', 'rack-2', 'rack-3'];

            for (const rackId of rackIds) {
                mockSensorsService.getLatestReading.mockResolvedValue(mockSensorReading);

                await controller.getLatestReading(rackId);

                expect(mockSensorsService.getLatestReading).toHaveBeenCalledWith(rackId);
            }
        });
    });

    describe('getReadings', () => {
        it('should retrieve readings without date filters', async () => {
            mockSensorsService.getReadings.mockResolvedValue(mockReadings);

            const result = await controller.getReadings(testRackId);

            expect(mockSensorsService.getReadings).toHaveBeenCalledWith(
                testRackId,
                undefined,
                undefined,
                undefined,
            );
            expect(result).toEqual(mockReadings);
        });

        it('should retrieve readings with startDate', async () => {
            const startDate = '2025-02-01T00:00:00.000Z';
            mockSensorsService.getReadings.mockResolvedValue(mockReadings);

            await controller.getReadings(testRackId, startDate);

            expect(mockSensorsService.getReadings).toHaveBeenCalledWith(
                testRackId,
                new Date(startDate),
                undefined,
                undefined,
            );
        });

        it('should retrieve readings with endDate', async () => {
            const endDate = '2025-02-02T00:00:00.000Z';
            mockSensorsService.getReadings.mockResolvedValue(mockReadings);

            await controller.getReadings(testRackId, undefined, endDate);

            expect(mockSensorsService.getReadings).toHaveBeenCalledWith(
                testRackId,
                undefined,
                new Date(endDate),
                undefined,
            );
        });

        it('should retrieve readings with both dates', async () => {
            const startDate = '2025-02-01T00:00:00.000Z';
            const endDate = '2025-02-02T00:00:00.000Z';
            mockSensorsService.getReadings.mockResolvedValue(mockReadings);

            await controller.getReadings(testRackId, startDate, endDate);

            expect(mockSensorsService.getReadings).toHaveBeenCalledWith(
                testRackId,
                new Date(startDate),
                new Date(endDate),
                undefined,
            );
        });

        it('should retrieve readings with custom limit', async () => {
            mockSensorsService.getReadings.mockResolvedValue(mockReadings);

            await controller.getReadings(testRackId, undefined, undefined, 50);

            expect(mockSensorsService.getReadings).toHaveBeenCalledWith(
                testRackId,
                undefined,
                undefined,
                50,
            );
        });

        it('should retrieve readings with all parameters', async () => {
            const startDate = '2025-02-01T00:00:00.000Z';
            const endDate = '2025-02-02T00:00:00.000Z';
            const limit = 50;
            mockSensorsService.getReadings.mockResolvedValue(mockReadings);

            await controller.getReadings(testRackId, startDate, endDate, limit);

            expect(mockSensorsService.getReadings).toHaveBeenCalledWith(
                testRackId,
                new Date(startDate),
                new Date(endDate),
                limit,
            );
        });

        it('should call SensorsService.getReadings once', async () => {
            mockSensorsService.getReadings.mockResolvedValue(mockReadings);

            await controller.getReadings(testRackId);

            expect(mockSensorsService.getReadings).toHaveBeenCalledTimes(1);
        });

        it('should return empty array when no readings found', async () => {
            mockSensorsService.getReadings.mockResolvedValue([]);

            const result = await controller.getReadings(testRackId);

            expect(result).toEqual([]);
        });

        it('should propagate service errors', async () => {
            const serviceError = new Error('Service error');
            mockSensorsService.getReadings.mockRejectedValue(serviceError);

            await expect(controller.getReadings(testRackId)).rejects.toThrow('Service error');
        });
    });

    describe('getAggregated', () => {
        it('should verify rack ownership', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getAggregatedData.mockResolvedValue(mockAggregatedData);

            await controller.getAggregated(testRackId, 24, testUser);

            expect(mockRacksService.verifyRackOwnership).toHaveBeenCalledWith(
                testRackId,
                testUser.firebaseUid,
            );
        });

        it('should retrieve aggregated data with default hours', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getAggregatedData.mockResolvedValue(mockAggregatedData);

            await controller.getAggregated(testRackId, 24, testUser);

            expect(mockSensorsService.getAggregatedData).toHaveBeenCalledWith(testRackId, 24);
        });

        it('should retrieve aggregated data with custom hours', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getAggregatedData.mockResolvedValue(mockAggregatedData);

            await controller.getAggregated(testRackId, 48, testUser);

            expect(mockSensorsService.getAggregatedData).toHaveBeenCalledWith(testRackId, 48);
        });

        it('should return formatted response', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getAggregatedData.mockResolvedValue(mockAggregatedData);

            const result = await controller.getAggregated(testRackId, 24, testUser);

            expect(result).toEqual({
                message: 'Aggregated sensor data retrieved',
                data: mockAggregatedData,
                count: mockAggregatedData.length,
                periodHours: 24,
            });
        });

        it('should include correct count in response', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getAggregatedData.mockResolvedValue(mockAggregatedData);

            const result = await controller.getAggregated(testRackId, 24, testUser);

            expect(result.count).toBe(1);
        });

        it('should include correct periodHours in response', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getAggregatedData.mockResolvedValue(mockAggregatedData);

            const result = await controller.getAggregated(testRackId, 48, testUser);

            expect(result.periodHours).toBe(48);
        });

        it('should propagate ownership verification errors', async () => {
            const ownershipError = new Error('Access denied');
            mockRacksService.verifyRackOwnership.mockRejectedValue(ownershipError);

            await expect(controller.getAggregated(testRackId, 24, testUser)).rejects.toThrow(
                'Access denied',
            );
        });

        it('should not call service if ownership verification fails', async () => {
            mockRacksService.verifyRackOwnership.mockRejectedValue(new Error('Access denied'));

            await expect(controller.getAggregated(testRackId, 24, testUser)).rejects.toThrow();

            expect(mockSensorsService.getAggregatedData).not.toHaveBeenCalled();
        });

        it('should propagate service errors', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            const serviceError = new Error('Service error');
            mockSensorsService.getAggregatedData.mockRejectedValue(serviceError);

            await expect(controller.getAggregated(testRackId, 24, testUser)).rejects.toThrow(
                'Service error',
            );
        });

        it('should return empty data array when no aggregated data', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getAggregatedData.mockResolvedValue([]);

            const result = await controller.getAggregated(testRackId, 24, testUser);

            expect(result.data).toEqual([]);
            expect(result.count).toBe(0);
        });
    });

    describe('getHistory', () => {
        it('should verify rack ownership', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getHistory.mockResolvedValue(mockReadings);

            await controller.getHistory(testRackId, 24, testUser);

            expect(mockRacksService.verifyRackOwnership).toHaveBeenCalledWith(
                testRackId,
                testUser.firebaseUid,
            );
        });

        it('should retrieve history with default hours', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getHistory.mockResolvedValue(mockReadings);

            await controller.getHistory(testRackId, 24, testUser);

            expect(mockSensorsService.getHistory).toHaveBeenCalledWith(testRackId, 24);
        });

        it('should retrieve history with custom hours', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getHistory.mockResolvedValue(mockReadings);

            await controller.getHistory(testRackId, 48, testUser);

            expect(mockSensorsService.getHistory).toHaveBeenCalledWith(testRackId, 48);
        });

        it('should return formatted response', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getHistory.mockResolvedValue(mockReadings);

            const result = await controller.getHistory(testRackId, 24, testUser);

            expect(result).toEqual({
                message: 'Sensor reading history retrieved',
                data: mockReadings,
                count: mockReadings.length,
                periodHours: 24,
            });
        });

        it('should include correct count in response', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getHistory.mockResolvedValue(mockReadings);

            const result = await controller.getHistory(testRackId, 24, testUser);

            expect(result.count).toBe(2);
        });

        it('should include correct periodHours in response', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getHistory.mockResolvedValue(mockReadings);

            const result = await controller.getHistory(testRackId, 72, testUser);

            expect(result.periodHours).toBe(72);
        });

        it('should propagate ownership verification errors', async () => {
            const ownershipError = new Error('Access denied');
            mockRacksService.verifyRackOwnership.mockRejectedValue(ownershipError);

            await expect(controller.getHistory(testRackId, 24, testUser)).rejects.toThrow(
                'Access denied',
            );
        });

        it('should not call service if ownership verification fails', async () => {
            mockRacksService.verifyRackOwnership.mockRejectedValue(new Error('Access denied'));

            await expect(controller.getHistory(testRackId, 24, testUser)).rejects.toThrow();

            expect(mockSensorsService.getHistory).not.toHaveBeenCalled();
        });

        it('should propagate service errors', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            const serviceError = new Error('Service error');
            mockSensorsService.getHistory.mockRejectedValue(serviceError);

            await expect(controller.getHistory(testRackId, 24, testUser)).rejects.toThrow(
                'Service error',
            );
        });

        it('should return empty data array when no history', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getHistory.mockResolvedValue([]);

            const result = await controller.getHistory(testRackId, 24, testUser);

            expect(result.data).toEqual([]);
            expect(result.count).toBe(0);
        });
    });

    describe('getStatistics', () => {
        it('should verify rack ownership', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getStatistics.mockResolvedValue(mockStatistics);

            await controller.getStatistics(testRackId, 24, testUser);

            expect(mockRacksService.verifyRackOwnership).toHaveBeenCalledWith(
                testRackId,
                testUser.firebaseUid,
            );
        });

        it('should retrieve statistics with default hours', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getStatistics.mockResolvedValue(mockStatistics);

            await controller.getStatistics(testRackId, 24, testUser);

            expect(mockSensorsService.getStatistics).toHaveBeenCalledWith(testRackId, 24);
        });

        it('should retrieve statistics with custom hours', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getStatistics.mockResolvedValue(mockStatistics);

            await controller.getStatistics(testRackId, 48, testUser);

            expect(mockSensorsService.getStatistics).toHaveBeenCalledWith(testRackId, 48);
        });

        it('should return formatted response', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getStatistics.mockResolvedValue(mockStatistics);

            const result = await controller.getStatistics(testRackId, 24, testUser);

            expect(result).toEqual({
                message: 'Sensor statistics retrieved',
                data: mockStatistics,
            });
        });

        it('should include statistics in response', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getStatistics.mockResolvedValue(mockStatistics);

            const result = await controller.getStatistics(testRackId, 24, testUser);

            expect(result.data).toEqual(mockStatistics);
            expect(result.data?.temperature).toBeDefined();
            expect(result.data?.humidity).toBeDefined();
            expect(result.data?.moisture).toBeDefined();
            expect(result.data?.lightLevel).toBeDefined();
        });

        it('should return null data when no statistics available', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getStatistics.mockResolvedValue(null);

            const result = await controller.getStatistics(testRackId, 24, testUser);

            expect(result).toEqual({
                message: 'Sensor statistics retrieved',
                data: null,
            });
        });

        it('should propagate ownership verification errors', async () => {
            const ownershipError = new Error('Access denied');
            mockRacksService.verifyRackOwnership.mockRejectedValue(ownershipError);

            await expect(controller.getStatistics(testRackId, 24, testUser)).rejects.toThrow(
                'Access denied',
            );
        });

        it('should not call service if ownership verification fails', async () => {
            mockRacksService.verifyRackOwnership.mockRejectedValue(new Error('Access denied'));

            await expect(controller.getStatistics(testRackId, 24, testUser)).rejects.toThrow();

            expect(mockSensorsService.getStatistics).not.toHaveBeenCalled();
        });

        it('should propagate service errors', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            const serviceError = new Error('Service error');
            mockSensorsService.getStatistics.mockRejectedValue(serviceError);

            await expect(controller.getStatistics(testRackId, 24, testUser)).rejects.toThrow(
                'Service error',
            );
        });
    });

    describe('integration with services', () => {
        it('should delegate all logic to services', async () => {
            mockSensorsService.getLatestReading.mockResolvedValue(mockSensorReading);
            mockSensorsService.getReadings.mockResolvedValue(mockReadings);
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getAggregatedData.mockResolvedValue(mockAggregatedData);
            mockSensorsService.getHistory.mockResolvedValue(mockReadings);
            mockSensorsService.getStatistics.mockResolvedValue(mockStatistics);

            await controller.getLatestReading(testRackId);
            await controller.getReadings(testRackId);
            await controller.getAggregated(testRackId, 24, testUser);
            await controller.getHistory(testRackId, 24, testUser);
            await controller.getStatistics(testRackId, 24, testUser);

            expect(mockSensorsService.getLatestReading).toHaveBeenCalled();
            expect(mockSensorsService.getReadings).toHaveBeenCalled();
            expect(mockSensorsService.getAggregatedData).toHaveBeenCalled();
            expect(mockSensorsService.getHistory).toHaveBeenCalled();
            expect(mockSensorsService.getStatistics).toHaveBeenCalled();
        });

        it('should not add additional business logic for getLatestReading', async () => {
            mockSensorsService.getLatestReading.mockResolvedValue(mockSensorReading);

            const result = await controller.getLatestReading(testRackId);

            expect(result).toBe(mockSensorReading);
        });

        it('should not add additional business logic for getReadings', async () => {
            mockSensorsService.getReadings.mockResolvedValue(mockReadings);

            const result = await controller.getReadings(testRackId);

            expect(result).toBe(mockReadings);
        });

        it('should format responses for protected endpoints', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getAggregatedData.mockResolvedValue(mockAggregatedData);

            const result = await controller.getAggregated(testRackId, 24, testUser);

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('count');
        });
    });

    describe('error propagation', () => {
        it('should not catch service errors in getLatestReading', async () => {
            const serviceError = new Error('Service error');
            mockSensorsService.getLatestReading.mockRejectedValue(serviceError);

            await expect(controller.getLatestReading(testRackId)).rejects.toThrow('Service error');
        });

        it('should not catch service errors in getReadings', async () => {
            const serviceError = new Error('Service error');
            mockSensorsService.getReadings.mockRejectedValue(serviceError);

            await expect(controller.getReadings(testRackId)).rejects.toThrow('Service error');
        });

        it('should not catch ownership errors in getAggregated', async () => {
            mockRacksService.verifyRackOwnership.mockRejectedValue(new Error('Access denied'));

            await expect(controller.getAggregated(testRackId, 24, testUser)).rejects.toThrow(
                'Access denied',
            );
        });

        it('should not catch ownership errors in getHistory', async () => {
            mockRacksService.verifyRackOwnership.mockRejectedValue(new Error('Access denied'));

            await expect(controller.getHistory(testRackId, 24, testUser)).rejects.toThrow(
                'Access denied',
            );
        });

        it('should not catch ownership errors in getStatistics', async () => {
            mockRacksService.verifyRackOwnership.mockRejectedValue(new Error('Access denied'));

            await expect(controller.getStatistics(testRackId, 24, testUser)).rejects.toThrow(
                'Access denied',
            );
        });
    });

    describe('parameter handling', () => {
        it('should handle rackId parameter in all endpoints', async () => {
            mockSensorsService.getLatestReading.mockResolvedValue(mockSensorReading);

            await controller.getLatestReading(testRackId);

            expect(mockSensorsService.getLatestReading).toHaveBeenCalledWith(testRackId);
        });

        it('should convert string dates to Date objects', async () => {
            const startDate = '2025-02-01T00:00:00.000Z';
            mockSensorsService.getReadings.mockResolvedValue(mockReadings);

            await controller.getReadings(testRackId, startDate);

            expect(mockSensorsService.getReadings).toHaveBeenCalledWith(
                testRackId,
                new Date(startDate),
                undefined,
                undefined,
            );
        });

        it('should convert hours to number', async () => {
            mockRacksService.verifyRackOwnership.mockResolvedValue(undefined);
            mockSensorsService.getAggregatedData.mockResolvedValue(mockAggregatedData);

            await controller.getAggregated(testRackId, 24, testUser);

            expect(mockSensorsService.getAggregatedData).toHaveBeenCalledWith(testRackId, 24);
        });

        it('should handle undefined optional parameters', async () => {
            mockSensorsService.getReadings.mockResolvedValue(mockReadings);

            await controller.getReadings(testRackId, undefined, undefined, undefined);

            expect(mockSensorsService.getReadings).toHaveBeenCalledWith(
                testRackId,
                undefined,
                undefined,
                undefined,
            );
        });
    });

    describe('ownership verification workflow', () => {
        it('should verify ownership before getting aggregated data', async () => {
            const verificationOrder: string[] = [];

            mockRacksService.verifyRackOwnership.mockImplementation(() => {
                verificationOrder.push('verify');
            });

            mockSensorsService.getAggregatedData.mockImplementation(() => {
                verificationOrder.push('getData');
                return mockAggregatedData;
            });

            await controller.getAggregated(testRackId, 24, testUser);

            expect(verificationOrder).toEqual(['verify', 'getData']);
        });

        it('should verify ownership before getting history', async () => {
            const verificationOrder: string[] = [];

            mockRacksService.verifyRackOwnership.mockImplementation(() => {
                verificationOrder.push('verify');
            });

            mockSensorsService.getHistory.mockImplementation(() => {
                verificationOrder.push('getHistory');
                return mockReadings;
            });

            await controller.getHistory(testRackId, 24, testUser);

            expect(verificationOrder).toEqual(['verify', 'getHistory']);
        });

        it('should verify ownership before getting statistics', async () => {
            const verificationOrder: string[] = [];

            mockRacksService.verifyRackOwnership.mockImplementation(() => {
                verificationOrder.push('verify');
            });

            mockSensorsService.getStatistics.mockImplementation(() => {
                verificationOrder.push('getStats');
                return mockStatistics;
            });

            await controller.getStatistics(testRackId, 24, testUser);

            expect(verificationOrder).toEqual(['verify', 'getStats']);
        });
    });
});
