/**
 * WebSocket Test Fixtures
 * Reusable data objects for websocket gateway and service tests
 */

import { NotificationStatus, type Notification } from '../../src/generated/prisma';
import { type AutomatedEventDto } from '../../src/automation/dto';
import { type DecodedIdToken } from 'firebase-admin/auth';

/**
 * Mock notification for broadcasting tests
 */
export const mockNotification: Notification = {
    id: 'notif-123',
    rackId: 'rack-123',
    userId: 'user-123',
    title: 'Rack Status Alert',
    message: 'Rack went offline',
    type: 'SYSTEM',
    status: NotificationStatus.UNREAD,
    readAt: null,
    metadata: null,
    createdAt: new Date('2026-02-01T10:00:00.000Z'),
    updatedAt: new Date('2026-02-01T10:00:00.000Z'),
};

/**
 * Mock automation event for broadcasting tests
 */
export const mockAutomationEvent: AutomatedEventDto = {
    rackId: 'rack-123',
    ruleName: 'Temperature Threshold Monitor',
    executedActions: ['alert: temperature_exceeded', 'notification: sent'],
    timestamp: new Date('2026-02-01T10:00:00.000Z'),
};

/**
 * Alternative notification for diversity in tests
 */
export const alternativeNotification: Notification = {
    id: 'notif-456',
    rackId: 'rack-456',
    userId: 'user-456',
    title: 'Watering Cycle Complete',
    message: 'Watering cycle finished successfully',
    type: 'SUCCESS',
    status: NotificationStatus.READ,
    readAt: new Date('2026-02-01T11:00:00.000Z'),
    metadata: null,
    createdAt: new Date('2026-02-01T11:00:00.000Z'),
    updatedAt: new Date('2026-02-01T11:00:00.000Z'),
};

/**
 * Alternative automation event for diversity in tests
 */
export const alternativeAutomationEvent: AutomatedEventDto = {
    rackId: 'rack-456',
    ruleName: 'Auto Watering Cycle',
    executedActions: ['watering: start for 5000ms', 'growLight: on'],
    timestamp: new Date('2026-02-01T12:00:00.000Z'),
};

/**
 * Common test socket IDs
 */
export const testSocketIds = {
    primary: 'socket-123',
    secondary: 'socket-456',
    tertiary: 'socket-789',
};

/**
 * Expected WebSocket event names
 */
export const websocketEvents = {
    sensorData: 'sensorData',
    deviceStatus: 'deviceStatus',
    notification: 'notification',
    automationEvent: 'automationEvent',
    error: 'error',
};

/**
 * Device status values
 */
export const deviceStatuses = {
    online: 'ONLINE',
    offline: 'OFFLINE',
    error: 'ERROR',
    maintenance: 'MAINTENANCE',
};

/**
 * Mock room names
 */
export const mockRoomNames = {
    rack1: 'rack-rack-123',
    rack2: 'rack-rack-456',
    user1: 'user-user-123',
};

/**
 * Expected error codes
 */
export const websocketErrorCodes = {
    authMissing: 'AUTH_MISSING',
    authInvalid: 'AUTH_INVALID',
    unauthorized: 'UNAUTHORIZED',
    validation: 'VALIDATION_ERROR',
};

/**
 * Valid Firebase token for testing
 */
export const validFirebaseToken: DecodedIdToken = {
    uid: 'firebase-uid-user-123',
    iss: 'https://securetoken.google.com/nurtura-project',
    aud: 'nurtura-project',
    auth_time: Math.floor(Date.now() / 1000),
    user_id: 'firebase-uid-user-123',
    sub: 'firebase-uid-user-123',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'test@example.com',
    email_verified: true,
    firebase: {
        identities: {
            email: ['test@example.com'],
        },
        sign_in_provider: 'password',
    },
};
