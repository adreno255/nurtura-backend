import { type Notification, type NotificationType } from '../../generated/prisma';
import { type PaginatedResponse } from '../../common/interfaces/pagination.interface';

export interface CreateNotificationPayload {
    userId: string;
    rackId?: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
}

export interface NotificationResponse {
    message: string;
    notification: Notification;
}

export interface NotificationDeletedResponse {
    message: string;
}

export interface NotificationListResponse extends PaginatedResponse<Notification> {
    unreadCount: number;
}
