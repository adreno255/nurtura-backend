import { NotificationStatus, NotificationType } from '../../src/generated/prisma';
import { type CreateNotificationPayload } from '../../src/notifications/interfaces/notification.interface';
import { type PaginationQueryDto } from '../../src/common/dto/pagination-query.dto';
import { HardwareType } from '../../src/racks/dto';

// ─────────────────────────────────────────────
// IDs
// ─────────────────────────────────────────────

export const testNotificationIds = {
    primary: 'notif-id-001',
    secondary: 'notif-id-002',
    tertiary: 'notif-id-003',
    nonExistent: 'notif-id-does-not-exist',
};

export const testNotificationUserIds = {
    primary: 'user-id-001',
    secondary: 'user-id-002',
};

export const testNotificationRackIds = {
    primary: 'rack-id-001',
    secondary: 'rack-id-002',
};

// ─────────────────────────────────────────────
// Base mock notification object
// ─────────────────────────────────────────────

export const mockNotification = {
    id: testNotificationIds.primary,
    userId: testNotificationUserIds.primary,
    rackId: testNotificationRackIds.primary,
    type: NotificationType.INFO,
    status: NotificationStatus.UNREAD,
    title: 'Rack Connected',
    message: 'My First Rack has been connected. Last seen at 2026-01-15T08:00:00.000Z',
    metadata: {
        screen: `/(tabs)/(racks)/${testNotificationRackIds.primary}`,
        online: true,
        timestamp: new Date('2026-01-15T08:00:00.000Z').toISOString(),
        firmwareVersion: 'v1.0.0',
        ipAddress: '192.168.1.1',
        macAddress: '00:1A:2B:3C:4D:5E',
        uptime: 3600,
    },
    readAt: null,
    createdAt: new Date('2026-01-15T08:00:00.000Z'),
    updatedAt: new Date('2026-01-15T08:00:00.000Z'),
};

export const mockReadNotification = {
    ...mockNotification,
    id: testNotificationIds.secondary,
    status: NotificationStatus.READ,
    readAt: new Date('2026-01-15T08:05:00.000Z'),
    type: NotificationType.INFO,
    title: 'Watering Completed',
    message: 'Automated watering has finished for rack My First Rack',
};

export const mockErrorNotification = {
    ...mockNotification,
    id: testNotificationIds.tertiary,
    rackId: null,
    type: NotificationType.ERROR,
    status: NotificationStatus.UNREAD,
    title: 'Component Malfunction Detected',
    message: 'An error with code SENSOR_FAILURE occurred on rack "My First Rack".',
    metadata: {
        screen: `/(tabs)/(racks)/${testNotificationRackIds.primary}`,
        code: 'SENSOR_FAILURE',
        message: 'The temperature sensor failed to respond.',
        severity: 'HIGH',
        timestamp: new Date('2026-01-15T09:00:00.000Z'),
        hardwareType: HardwareType.TEMPERATURE,
        details: {
            attemptCount: 3,
            lastSuccessfulRead: new Date('2026-01-15T08:55:00.000Z'),
            errorData: {},
        },
    },
};

export const mockAutomationNotification = {
    ...mockNotification,
    id: 'notif-id-automation',
    rackId: 'rack-id-automation',
    type: NotificationType.AUTOMATION,
    status: NotificationStatus.UNREAD,
    title: 'Watering Started',
    message: 'Rule "Letturce - Low Moisture" activated the water pump.',
    metadata: {
        screen: '/(tabs)/(activity)/plant-care',
        ruleId: 'rule-id-001',
        ruleName: 'Letturce - Low Moisture',
        action: 'watering_start',
    },
};

// ─────────────────────────────────────────────
// Collections
// ─────────────────────────────────────────────

export const mockNotifications = [mockNotification, mockReadNotification];

export const mockUnreadNotifications = [mockNotification];

// ─────────────────────────────────────────────
// After mark-as-read mutation
// ─────────────────────────────────────────────

export const mockNotificationAfterRead = {
    ...mockNotification,
    status: NotificationStatus.READ,
    readAt: new Date('2026-01-15T08:05:00.000Z'),
    updatedAt: new Date('2026-01-15T08:05:00.000Z'),
};

// ─────────────────────────────────────────────
// Pagination query fixtures
// ─────────────────────────────────────────────

export const defaultNotificationQuery: PaginationQueryDto = {
    page: 1,
    limit: 10,
};

export const secondPageNotificationQuery: PaginationQueryDto = {
    page: 2,
    limit: 5,
};

// ─────────────────────────────────────────────
// Paginated response shapes
// ─────────────────────────────────────────────

export const paginatedNotificationsResponse = {
    data: mockNotifications,
    meta: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 3,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
    },
    unreadCount: 2,
};

export const emptyNotificationsResponse = {
    data: [],
    meta: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
    },
    unreadCount: 0,
};

export const paginatedUnreadNotificationsResponse = {
    data: mockUnreadNotifications,
    meta: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
    },
    unreadCount: 2,
};

// ─────────────────────────────────────────────
// CreateNotificationPayload fixtures
// ─────────────────────────────────────────────

export const validCreateNotificationPayload: CreateNotificationPayload = {
    userId: testNotificationUserIds.primary,
    rackId: testNotificationRackIds.primary,
    type: NotificationType.INFO,
    title: 'Rack Disconnected',
    message: 'My First Rack has been disconnected. Last seen at 2026-01-15T08:00:00.000Z',
    metadata: {
        online: false,
        timestamp: new Date('2026-01-15T08:00:00.000Z'),
        firmwareVersion: 'v1.0.0',
        ipAddress: '192.168.1.1',
        macAddress: '00:1A:2B:3C:4D:5E',
        uptime: 3600,
    },
};

export const createNotificationPayloadWithoutRack: CreateNotificationPayload = {
    userId: testNotificationUserIds.primary,
    rackId: undefined,
    type: NotificationType.INFO,
    title: 'System Update',
    message: 'Nurtura system has been updated to v4.1.0',
};

// ─────────────────────────────────────────────
// Mock Expo push token
// ─────────────────────────────────────────────

export const mockExpoPushToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

// ─────────────────────────────────────────────
// User with push token (for push notification tests)
// ─────────────────────────────────────────────

export const mockUserWithPushToken = {
    expoPushToken: mockExpoPushToken,
};

export const mockUserWithoutPushToken = {
    expoPushToken: null,
};
