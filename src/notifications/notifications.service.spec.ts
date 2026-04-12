import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import {
    createMockDatabaseService,
    createMockLogger,
    createMockEventEmitter,
} from '../../test/mocks';
import {
    testNotificationIds,
    testNotificationUserIds,
    testNotificationRackIds,
    mockNotification,
    mockReadNotification,
    mockErrorNotification,
    mockNotifications,
    mockUnreadNotifications,
    mockNotificationAfterRead,
    defaultNotificationQuery,
    secondPageNotificationQuery,
    validCreateNotificationPayload,
    createNotificationPayloadWithoutRack,
    mockUserWithPushToken,
    mockUserWithoutPushToken,
    mockExpoPushToken,
} from '../../test/fixtures';
import { NotificationType } from '../generated/prisma';

// Mock global fetch for Expo push tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─────────────────────────────────────────────
// Additional fixtures needed for AUTOMATION & ERROR types
// ─────────────────────────────────────────────

const createErrorNotificationPayload = {
    userId: testNotificationUserIds.primary,
    rackId: testNotificationRackIds.primary,
    type: NotificationType.ERROR,
    title: 'Component Malfunction Detected',
    message: 'An error with code SENSOR_FAILURE occurred on rack "My First Rack".',
    metadata: { code: 'SENSOR_FAILURE', severity: 'HIGH' },
};

const createAutomationNotificationPayload = {
    userId: testNotificationUserIds.primary,
    rackId: testNotificationRackIds.primary,
    type: NotificationType.AUTOMATION,
    title: 'Watering Started',
    message: 'Rule "Letturce - Low Moisture" activated the water pump.',
    metadata: { ruleId: 'rule-id-001', ruleName: 'Letturce - Low Moisture' },
};

describe('NotificationsService', () => {
    let service: NotificationsService;

    const mockDatabaseService = createMockDatabaseService();
    const mockLoggerService = createMockLogger();
    const mockEventEmitter = createMockEventEmitter();

    const testUserId = testNotificationUserIds.primary;
    const testNotificationId = testNotificationIds.primary;
    const testRackId = testNotificationRackIds.primary;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockFetch.mockReset();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationsService,
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: MyLoggerService, useValue: mockLoggerService },
                { provide: EventEmitter2, useValue: mockEventEmitter },
            ],
        }).compile();

        service = module.get<NotificationsService>(NotificationsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ─────────────────────────────────────────────
    // handleCreateNotification
    // ─────────────────────────────────────────────

    describe('handleCreateNotification', () => {
        // ── INFO type ──────────────────────────────

        describe('INFO type', () => {
            it('should persist notification to database when rack exists', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithoutPushToken);

                await service.handleCreateNotification(validCreateNotificationPayload);

                expect(mockDatabaseService.notification.create).toHaveBeenCalledWith({
                    data: {
                        userId: validCreateNotificationPayload.userId,
                        rackId: testRackId,
                        type: validCreateNotificationPayload.type,
                        title: validCreateNotificationPayload.title,
                        message: validCreateNotificationPayload.message,
                        metadata: validCreateNotificationPayload.metadata,
                    },
                });
            });

            it('should emit broadcastUserNotification event after persisting', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithoutPushToken);

                await service.handleCreateNotification(validCreateNotificationPayload);

                expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                    'broadcastUserNotification',
                    validCreateNotificationPayload.userId,
                    mockNotification,
                );
            });

            it('should verify rack existence before creating notification', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithoutPushToken);

                await service.handleCreateNotification(validCreateNotificationPayload);

                expect(mockDatabaseService.rack.findUnique).toHaveBeenCalledWith({
                    where: { id: validCreateNotificationPayload.rackId },
                    select: { id: true },
                });
            });

            it('should create notification with null rackId when rack is not found', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue(null);
                mockDatabaseService.notification.create.mockResolvedValue({
                    ...mockNotification,
                    rackId: null,
                });
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithoutPushToken);

                await service.handleCreateNotification(validCreateNotificationPayload);

                expect(mockDatabaseService.notification.create).toHaveBeenCalledWith({
                    data: expect.objectContaining({ rackId: null }) as object,
                });
                expect(mockLoggerService.warn).toHaveBeenCalledWith(
                    expect.stringContaining('not found'),
                    'NotificationsService',
                );
            });

            it('should create notification with null rackId when payload has no rackId', async () => {
                mockDatabaseService.notification.create.mockResolvedValue({
                    ...mockNotification,
                    rackId: null,
                });
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithoutPushToken);

                await service.handleCreateNotification(createNotificationPayloadWithoutRack);

                expect(mockDatabaseService.rack.findUnique).not.toHaveBeenCalled();
                expect(mockDatabaseService.notification.create).toHaveBeenCalledWith({
                    data: expect.objectContaining({ rackId: null }) as object,
                });
            });

            it('should log success after persisting notification', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithoutPushToken);

                await service.handleCreateNotification(validCreateNotificationPayload);

                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    expect.stringContaining(`Notification created for user ${testUserId}`),
                    'NotificationsService',
                );
            });

            it('should handle notification with undefined metadata gracefully', async () => {
                const payloadWithoutMetadata = {
                    ...validCreateNotificationPayload,
                    metadata: undefined,
                };

                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue({
                    ...mockNotification,
                    metadata: null,
                });
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithoutPushToken);

                await service.handleCreateNotification(payloadWithoutMetadata);

                expect(mockDatabaseService.notification.create).toHaveBeenCalledWith({
                    data: expect.objectContaining({ metadata: undefined }) as object,
                });
            });
        });

        // ── ERROR type ─────────────────────────────

        describe('ERROR type', () => {
            it('should persist ERROR notification to the database', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockErrorNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithoutPushToken);

                await service.handleCreateNotification(createErrorNotificationPayload);

                expect(mockDatabaseService.notification.create).toHaveBeenCalledWith({
                    data: expect.objectContaining({
                        type: NotificationType.ERROR,
                        title: createErrorNotificationPayload.title,
                    }) as object,
                });
            });

            it('should emit broadcastUserNotification event for ERROR type', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockErrorNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithoutPushToken);

                await service.handleCreateNotification(createErrorNotificationPayload);

                expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                    'broadcastUserNotification',
                    createErrorNotificationPayload.userId,
                    mockErrorNotification,
                );
            });

            it('should send Expo push for ERROR type when user has token', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockErrorNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithPushToken);

                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => await Promise.resolve({ data: { status: 'ok' } }),
                });

                await service.handleCreateNotification(createErrorNotificationPayload);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://exp.host/--/api/v2/push/send',
                    expect.objectContaining({
                        method: 'POST',
                        body: expect.stringContaining(mockExpoPushToken) as string,
                    }),
                );
            });
        });

        // ── AUTOMATION type ────────────────────────

        describe('AUTOMATION type', () => {
            it('should NOT persist AUTOMATION notification to the database', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithPushToken);

                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => await Promise.resolve({ data: { status: 'ok' } }),
                });

                await service.handleCreateNotification(createAutomationNotificationPayload);

                expect(mockDatabaseService.notification.create).not.toHaveBeenCalled();
            });

            it('should NOT emit broadcastUserNotification for AUTOMATION type', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithPushToken);

                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => await Promise.resolve({ data: { status: 'ok' } }),
                });

                await service.handleCreateNotification(createAutomationNotificationPayload);

                expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
                    'broadcastUserNotification',
                    expect.anything(),
                    expect.anything(),
                );
            });

            it('should still send Expo push for AUTOMATION type when user has token', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithPushToken);

                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => await Promise.resolve({ data: { status: 'ok' } }),
                });

                await service.handleCreateNotification(createAutomationNotificationPayload);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://exp.host/--/api/v2/push/send',
                    expect.objectContaining({
                        method: 'POST',
                        body: expect.stringContaining(mockExpoPushToken) as string,
                    }),
                );
            });

            it('should pass null as notificationId in Expo push data for AUTOMATION type', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithPushToken);

                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => await Promise.resolve({ data: { status: 'ok' } }),
                });

                await service.handleCreateNotification(createAutomationNotificationPayload);

                const [, fetchOptions] = mockFetch.mock.calls[0] as [string, { body: string }];
                const body = JSON.parse(fetchOptions.body) as {
                    data: { notificationId: string | null };
                };

                expect(body.data.notificationId).toBeNull();
            });

            it('should skip Expo push for AUTOMATION type when user has no token', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithoutPushToken);

                await service.handleCreateNotification(createAutomationNotificationPayload);

                expect(mockFetch).not.toHaveBeenCalled();
                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    expect.stringContaining('No Expo push token'),
                    'NotificationsService',
                );
            });
        });

        // ── Shared error-handling ──────────────────

        describe('error handling', () => {
            it('should log and return early when database write fails', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockRejectedValue(new Error('DB error'));

                await service.handleCreateNotification(validCreateNotificationPayload);

                expect(mockLoggerService.error).toHaveBeenCalledWith(
                    expect.stringContaining(
                        `Failed to persist notification for user ${testUserId}`,
                    ),
                    'DB error',
                    'NotificationsService',
                );
                expect(mockDatabaseService.user.findUnique).not.toHaveBeenCalled();
            });

            it('should not send push when user has no Expo push token', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithoutPushToken);

                await service.handleCreateNotification(validCreateNotificationPayload);

                expect(mockFetch).not.toHaveBeenCalled();
                expect(mockLoggerService.log).toHaveBeenCalledWith(
                    expect.stringContaining('No Expo push token'),
                    'NotificationsService',
                );
            });

            it('should send Expo push when user has a registered token', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithPushToken);

                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => await Promise.resolve({ data: { status: 'ok' } }),
                });

                await service.handleCreateNotification(validCreateNotificationPayload);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://exp.host/--/api/v2/push/send',
                    expect.objectContaining({
                        method: 'POST',
                        body: expect.stringContaining(mockExpoPushToken) as string,
                    }),
                );
            });

            it('should include notificationId in Expo push data payload for saved notifications', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithPushToken);

                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => await Promise.resolve({ data: { status: 'ok' } }),
                });

                await service.handleCreateNotification(validCreateNotificationPayload);

                const [, fetchOptions] = mockFetch.mock.calls[0] as [string, { body: string }];
                const body = JSON.parse(fetchOptions.body) as { data: { notificationId: string } };

                expect(body.data.notificationId).toBe(testNotificationIds.primary);
            });

            it('should log and continue when Expo push fails (non-fatal)', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithPushToken);

                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 500,
                    text: async () => await Promise.resolve('Internal Server Error'),
                });

                await service.handleCreateNotification(validCreateNotificationPayload);

                expect(mockLoggerService.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Failed to send Expo push for user ${testUserId}`),
                    expect.any(String),
                    'NotificationsService',
                );
            });

            it('should log error when Expo push API returns error status', async () => {
                mockDatabaseService.rack.findUnique.mockResolvedValue({ id: testRackId });
                mockDatabaseService.notification.create.mockResolvedValue(mockNotification);
                mockDatabaseService.user.findUnique.mockResolvedValue(mockUserWithPushToken);

                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () =>
                        await Promise.resolve({
                            data: { status: 'error', message: 'DeviceNotRegistered' },
                        }),
                });

                await service.handleCreateNotification(validCreateNotificationPayload);

                expect(mockLoggerService.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Failed to send Expo push for user ${testUserId}`),
                    expect.stringContaining('DeviceNotRegistered'),
                    'NotificationsService',
                );
            });
        });
    });

    // ─────────────────────────────────────────────
    // findAll
    // ─────────────────────────────────────────────

    describe('findAll', () => {
        beforeEach(() => {
            mockDatabaseService.notification.count.mockResolvedValue(mockNotifications.length);
        });

        it('should return paginated notifications for a user', async () => {
            mockDatabaseService.notification.findMany.mockResolvedValue(mockNotifications);

            const result = await service.findAll(testUserId, defaultNotificationQuery);

            expect(result.data).toEqual(mockNotifications);
            expect(result.meta.totalItems).toBe(mockNotifications.length);
            expect(result.meta.currentPage).toBe(1);
        });

        it('should query notifications filtered by userId', async () => {
            mockDatabaseService.notification.findMany.mockResolvedValue(mockNotifications);

            await service.findAll(testUserId, defaultNotificationQuery);

            expect(mockDatabaseService.notification.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ userId: testUserId }) as object,
                }),
            );
        });

        it('should filter by UNREAD status when unreadOnly is true', async () => {
            mockDatabaseService.notification.findMany.mockResolvedValue(mockUnreadNotifications);
            mockDatabaseService.notification.count.mockResolvedValue(
                mockUnreadNotifications.length,
            );

            await service.findAll(testUserId, defaultNotificationQuery, true);

            expect(mockDatabaseService.notification.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ status: 'UNREAD' }) as object,
                }),
            );
        });

        it('should not filter by status when unreadOnly is false', async () => {
            mockDatabaseService.notification.findMany.mockResolvedValue(mockNotifications);

            await service.findAll(testUserId, defaultNotificationQuery, false);

            const [callArg] = mockDatabaseService.notification.findMany.mock.calls[0] as [
                { where: object },
            ];

            expect(callArg.where).not.toHaveProperty('status');
        });

        it('should order notifications by createdAt descending', async () => {
            mockDatabaseService.notification.findMany.mockResolvedValue(mockNotifications);

            await service.findAll(testUserId, defaultNotificationQuery);

            expect(mockDatabaseService.notification.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
            );
        });

        it('should include unreadCount in the response', async () => {
            mockDatabaseService.notification.findMany.mockResolvedValue(mockNotifications);
            mockDatabaseService.notification.count
                .mockResolvedValueOnce(mockNotifications.length) // total count
                .mockResolvedValueOnce(2); // unread count

            const result = await service.findAll(testUserId, defaultNotificationQuery);

            expect(result).toHaveProperty('unreadCount');
            expect(typeof result.unreadCount).toBe('number');
        });

        it('should handle pagination on second page', async () => {
            mockDatabaseService.notification.findMany.mockResolvedValue([mockErrorNotification]);
            mockDatabaseService.notification.count.mockResolvedValue(6);

            const result = await service.findAll(testUserId, secondPageNotificationQuery);

            expect(result.meta.currentPage).toBe(2);
            expect(result.meta.itemsPerPage).toBe(5);
        });

        it('should return empty response when user has no notifications', async () => {
            mockDatabaseService.notification.findMany.mockResolvedValue([]);
            mockDatabaseService.notification.count.mockResolvedValue(0);

            const result = await service.findAll(testUserId, defaultNotificationQuery);

            expect(result.data).toEqual([]);
            expect(result.meta.totalItems).toBe(0);
            expect(result.meta.totalPages).toBe(0);
        });

        it('should log successful fetch', async () => {
            mockDatabaseService.notification.findMany.mockResolvedValue(mockNotifications);

            await service.findAll(testUserId, defaultNotificationQuery);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining(`Fetched ${mockNotifications.length} notifications`),
                'NotificationsService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.notification.findMany.mockRejectedValue(new Error('DB error'));

            await expect(service.findAll(testUserId, defaultNotificationQuery)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.findAll(testUserId, defaultNotificationQuery)).rejects.toThrow(
                'Failed to fetch notifications',
            );
        });

        it('should log error on database failure', async () => {
            const dbError = new Error('Connection timeout');
            mockDatabaseService.notification.findMany.mockRejectedValue(dbError);

            await expect(service.findAll(testUserId, defaultNotificationQuery)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to fetch notifications for user: ${testUserId}`),
                dbError.message,
                'NotificationsService',
            );
        });
    });

    // ─────────────────────────────────────────────
    // hasUnreadNotifications
    // ─────────────────────────────────────────────

    describe('hasUnreadNotifications', () => {
        it('should return hasUnread: true when unread notifications exist', async () => {
            mockDatabaseService.notification.findFirst.mockResolvedValue(mockNotification);

            const result = await service.hasUnreadNotifications(testUserId);

            expect(result).toEqual({ hasUnread: true });
        });

        it('should return hasUnread: false when no unread notifications exist', async () => {
            mockDatabaseService.notification.findFirst.mockResolvedValue(null);

            const result = await service.hasUnreadNotifications(testUserId);

            expect(result).toEqual({ hasUnread: false });
        });

        it('should query only UNREAD notifications for the user', async () => {
            mockDatabaseService.notification.findFirst.mockResolvedValue(mockNotification);

            await service.hasUnreadNotifications(testUserId);

            expect(mockDatabaseService.notification.findFirst).toHaveBeenCalledWith({
                where: { userId: testUserId, status: 'UNREAD' },
                select: { id: true },
            });
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.notification.findFirst.mockRejectedValue(new Error('DB error'));

            await expect(service.hasUnreadNotifications(testUserId)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.hasUnreadNotifications(testUserId)).rejects.toThrow(
                'Failed to check unread notifications',
            );
        });

        it('should log error on database failure', async () => {
            const dbError = new Error('DB error');
            mockDatabaseService.notification.findFirst.mockRejectedValue(dbError);

            await expect(service.hasUnreadNotifications(testUserId)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Failed to check unread notifications for user: ${testUserId}`,
                ),
                dbError.message,
                'NotificationsService',
            );
        });
    });

    // ─────────────────────────────────────────────
    // markAsRead
    // ─────────────────────────────────────────────

    describe('markAsRead', () => {
        it('should mark an unread notification as read successfully', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockNotification);
            mockDatabaseService.notification.update.mockResolvedValue(mockNotificationAfterRead);

            const result = await service.markAsRead(testNotificationId, testUserId);

            expect(result.message).toBe('Notification marked as read');
            expect(result.notification).toEqual(mockNotificationAfterRead);
        });

        it('should update status to READ and set readAt', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockNotification);
            mockDatabaseService.notification.update.mockResolvedValue(mockNotificationAfterRead);

            await service.markAsRead(testNotificationId, testUserId);

            expect(mockDatabaseService.notification.update).toHaveBeenCalledWith({
                where: { id: testNotificationId },
                data: {
                    status: 'READ',
                    readAt: expect.any(Date) as Date,
                },
            });
        });

        it('should not update notification that is already read', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockReadNotification);

            const result = await service.markAsRead(testNotificationIds.secondary, testUserId);

            expect(result.message).toBe('Notification already marked as read');
            expect(mockDatabaseService.notification.update).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException when notification does not exist', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(null);

            await expect(
                service.markAsRead(testNotificationIds.nonExistent, testUserId),
            ).rejects.toThrow(NotFoundException);
            await expect(
                service.markAsRead(testNotificationIds.nonExistent, testUserId),
            ).rejects.toThrow('Notification not found');
        });

        it('should throw NotFoundException when notification belongs to a different user', async () => {
            const otherUserNotification = {
                ...mockNotification,
                userId: testNotificationUserIds.secondary,
            };
            mockDatabaseService.notification.findUnique.mockResolvedValue(otherUserNotification);

            await expect(service.markAsRead(testNotificationId, testUserId)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should mark an ERROR notification as read', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockErrorNotification);
            mockDatabaseService.notification.update.mockResolvedValue({
                ...mockErrorNotification,
                status: 'READ',
                readAt: new Date(),
            });

            const result = await service.markAsRead(testNotificationIds.tertiary, testUserId);

            expect(result.message).toBe('Notification marked as read');
            expect(mockDatabaseService.notification.update).toHaveBeenCalled();
        });

        it('should log success after marking as read', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockNotification);
            mockDatabaseService.notification.update.mockResolvedValue(mockNotificationAfterRead);

            await service.markAsRead(testNotificationId, testUserId);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining(`Notification ${testNotificationId} marked as read`),
                'NotificationsService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockNotification);
            mockDatabaseService.notification.update.mockRejectedValue(new Error('DB error'));

            await expect(service.markAsRead(testNotificationId, testUserId)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.markAsRead(testNotificationId, testUserId)).rejects.toThrow(
                'Failed to mark notification as read',
            );
        });

        it('should log error on update failure', async () => {
            const dbError = new Error('DB write error');
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockNotification);
            mockDatabaseService.notification.update.mockRejectedValue(dbError);

            await expect(service.markAsRead(testNotificationId, testUserId)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Failed to mark notification ${testNotificationId} as read`,
                ),
                dbError.message,
                'NotificationsService',
            );
        });

        it('should re-throw NotFoundException without wrapping', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(null);

            await expect(service.markAsRead(testNotificationId, testUserId)).rejects.toThrow(
                NotFoundException,
            );

            expect(mockLoggerService.error).not.toHaveBeenCalled();
        });
    });

    // ─────────────────────────────────────────────
    // markAllAsRead
    // ─────────────────────────────────────────────

    describe('markAllAsRead', () => {
        it('should mark all unread notifications as read and return count', async () => {
            mockDatabaseService.notification.updateMany.mockResolvedValue({ count: 2 });

            const result = await service.markAllAsRead(testUserId);

            expect(result).toEqual({
                message: 'All notifications marked as read',
                updatedCount: 2,
            });
        });

        it('should filter by userId and UNREAD status', async () => {
            mockDatabaseService.notification.updateMany.mockResolvedValue({ count: 2 });

            await service.markAllAsRead(testUserId);

            expect(mockDatabaseService.notification.updateMany).toHaveBeenCalledWith({
                where: { userId: testUserId, status: 'UNREAD' },
                data: {
                    status: 'READ',
                    readAt: expect.any(Date) as Date,
                },
            });
        });

        it('should return count of 0 when no unread notifications exist', async () => {
            mockDatabaseService.notification.updateMany.mockResolvedValue({ count: 0 });

            const result = await service.markAllAsRead(testUserId);

            expect(result.updatedCount).toBe(0);
        });

        it('should log successful mark-all operation', async () => {
            mockDatabaseService.notification.updateMany.mockResolvedValue({ count: 3 });

            await service.markAllAsRead(testUserId);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining(`Marked 3 notifications as read for user: ${testUserId}`),
                'NotificationsService',
            );
        });

        it('should throw InternalServerErrorException on database error', async () => {
            mockDatabaseService.notification.updateMany.mockRejectedValue(new Error('DB error'));

            await expect(service.markAllAsRead(testUserId)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.markAllAsRead(testUserId)).rejects.toThrow(
                'Failed to mark all notifications as read',
            );
        });

        it('should log error on database failure', async () => {
            const dbError = new Error('DB error');
            mockDatabaseService.notification.updateMany.mockRejectedValue(dbError);

            await expect(service.markAllAsRead(testUserId)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Failed to mark all notifications as read for user: ${testUserId}`,
                ),
                dbError.message,
                'NotificationsService',
            );
        });
    });

    // ─────────────────────────────────────────────
    // remove
    // ─────────────────────────────────────────────

    describe('remove', () => {
        it('should delete a notification successfully', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockNotification);
            mockDatabaseService.notification.delete.mockResolvedValue(mockNotification);

            const result = await service.remove(testNotificationId, testUserId);

            expect(result).toEqual({ message: 'Notification deleted successfully' });
        });

        it('should query notification by id before deleting', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockNotification);
            mockDatabaseService.notification.delete.mockResolvedValue(mockNotification);

            await service.remove(testNotificationId, testUserId);

            expect(mockDatabaseService.notification.findUnique).toHaveBeenCalledWith({
                where: { id: testNotificationId },
            });
        });

        it('should delete by notification id', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockNotification);
            mockDatabaseService.notification.delete.mockResolvedValue(mockNotification);

            await service.remove(testNotificationId, testUserId);

            expect(mockDatabaseService.notification.delete).toHaveBeenCalledWith({
                where: { id: testNotificationId },
            });
        });

        it('should throw NotFoundException when notification does not exist', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(null);

            await expect(
                service.remove(testNotificationIds.nonExistent, testUserId),
            ).rejects.toThrow(NotFoundException);
            await expect(
                service.remove(testNotificationIds.nonExistent, testUserId),
            ).rejects.toThrow('Notification not found');
        });

        it('should throw NotFoundException when notification belongs to a different user', async () => {
            const otherUserNotification = {
                ...mockNotification,
                userId: testNotificationUserIds.secondary,
            };
            mockDatabaseService.notification.findUnique.mockResolvedValue(otherUserNotification);

            await expect(service.remove(testNotificationId, testUserId)).rejects.toThrow(
                NotFoundException,
            );

            expect(mockDatabaseService.notification.delete).not.toHaveBeenCalled();
        });

        it('should allow deleting an ERROR notification', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockErrorNotification);
            mockDatabaseService.notification.delete.mockResolvedValue(mockErrorNotification);

            const result = await service.remove(testNotificationIds.tertiary, testUserId);

            expect(result).toEqual({ message: 'Notification deleted successfully' });
            expect(mockDatabaseService.notification.delete).toHaveBeenCalled();
        });

        it('should allow deleting a READ notification', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockReadNotification);
            mockDatabaseService.notification.delete.mockResolvedValue(mockReadNotification);

            const result = await service.remove(testNotificationIds.secondary, testUserId);

            expect(result).toEqual({ message: 'Notification deleted successfully' });
            expect(mockDatabaseService.notification.delete).toHaveBeenCalled();
        });

        it('should log success after deletion', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockNotification);
            mockDatabaseService.notification.delete.mockResolvedValue(mockNotification);

            await service.remove(testNotificationId, testUserId);

            expect(mockLoggerService.log).toHaveBeenCalledWith(
                expect.stringContaining(`Notification ${testNotificationId} deleted`),
                'NotificationsService',
            );
        });

        it('should throw InternalServerErrorException on database delete error', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockNotification);
            mockDatabaseService.notification.delete.mockRejectedValue(new Error('DB error'));

            await expect(service.remove(testNotificationId, testUserId)).rejects.toThrow(
                InternalServerErrorException,
            );
            await expect(service.remove(testNotificationId, testUserId)).rejects.toThrow(
                'Failed to delete notification',
            );
        });

        it('should log error on delete failure', async () => {
            const dbError = new Error('DB write error');
            mockDatabaseService.notification.findUnique.mockResolvedValue(mockNotification);
            mockDatabaseService.notification.delete.mockRejectedValue(dbError);

            await expect(service.remove(testNotificationId, testUserId)).rejects.toThrow();

            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to delete notification ${testNotificationId}`),
                dbError.message,
                'NotificationsService',
            );
        });

        it('should re-throw NotFoundException without wrapping', async () => {
            mockDatabaseService.notification.findUnique.mockResolvedValue(null);

            await expect(service.remove(testNotificationId, testUserId)).rejects.toThrow(
                NotFoundException,
            );

            expect(mockLoggerService.error).not.toHaveBeenCalled();
        });
    });
});
