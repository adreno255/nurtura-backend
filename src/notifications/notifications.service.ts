import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService } from '../database/database.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { PaginationHelper } from '../common/utils/pagination.helper';
import { type PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { type Prisma } from '../generated/prisma';
import {
    type CreateNotificationPayload,
    type NotificationListResponse,
    type NotificationResponse,
    type NotificationDeletedResponse,
} from './interfaces/notification.interface';

// Uses fetch directly to avoid adding expo-server-sdk as a dependency.
// Swap to the SDK if you need batch sending or receipt verification later.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class NotificationsService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly logger: MyLoggerService,
    ) {}

    // ==================== Event Listener ====================

    /**
     * Listens for 'createNotification' events emitted by other services
     * (e.g., AutomationService, RacksService, SensorsService).
     *
     * Two steps:
     *   1. Persist the notification to the database.
     *   2. Send an Expo push notification if the user has a registered token.
     *
     * Errors in either step are caught and logged — a notification failure
     * must never crash the calling service.
     *
     * Emitting example:
     *   this.eventEmitter.emit('createNotification', {
     *     userId: rack.userId,
     *     rackId: rack.id,
     *     type: NotificationType.ALERT,
     *     title: 'Low Soil Moisture',
     *     message: 'Soil moisture has dropped below 30%',
     *     metadata: { ruleId: rule.id, sensorValue: 28 },
     *   } satisfies CreateNotificationPayload);
     */
    @OnEvent('createNotification')
    async handleCreateNotification(payload: CreateNotificationPayload): Promise<void> {
        // Step 1: Persist to database
        let notificationId: string;

        try {
            const notification = await this.databaseService.notification.create({
                data: {
                    userId: payload.userId,
                    rackId: payload.rackId ?? null,
                    type: payload.type,
                    title: payload.title,
                    message: payload.message,
                    metadata: (payload.metadata as Prisma.InputJsonValue) ?? undefined,
                },
            });

            notificationId = notification.id;

            this.logger.log(
                `Notification created for user ${payload.userId}: "${payload.title}" (${notificationId})`,
                'NotificationsService',
            );
        } catch (error) {
            this.logger.error(
                `Failed to persist notification for user ${payload.userId}`,
                error instanceof Error ? error.message : String(error),
                'NotificationsService',
            );
            return; // No point sending a push if the DB write failed
        }

        // Step 2: Send Expo push notification if user has a registered token
        try {
            const user = await this.databaseService.user.findUnique({
                where: { id: payload.userId },
                select: { expoPushToken: true },
            });

            if (!user?.expoPushToken) {
                this.logger.log(
                    `No Expo push token registered for user ${payload.userId} — skipping push`,
                    'NotificationsService',
                );
                return;
            }

            await this.sendExpoPush(user.expoPushToken, payload.title, payload.message, {
                notificationId,
                rackId: payload.rackId,
                type: payload.type,
                ...(payload.metadata ?? {}),
            });
        } catch (error) {
            // Push failure is non-fatal — the notification is already saved in the DB
            this.logger.error(
                `Failed to send Expo push for user ${payload.userId}`,
                error instanceof Error ? error.message : String(error),
                'NotificationsService',
            );
        }
    }

    // ==================== Query Methods ====================

    /**
     * Get paginated notifications for the authenticated user.
     * Optionally filter by unread only.
     */
    async findAll(
        userId: string,
        query: PaginationQueryDto,
        unreadOnly?: boolean,
    ): Promise<NotificationListResponse> {
        try {
            const where: Prisma.NotificationWhereInput = {
                userId,
                ...(unreadOnly && { status: 'UNREAD' }),
            };

            const [notifications, totalItems] = await Promise.all([
                this.databaseService.notification.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    ...PaginationHelper.getPrismaOptions(query),
                }),
                this.databaseService.notification.count({ where }),
            ]);

            this.logger.log(
                `Fetched ${notifications.length} notifications for user: ${userId}`,
                'NotificationsService',
            );

            return {
                ...PaginationHelper.createResponse(notifications, totalItems, query),
                unreadCount: await this.getUnreadCount(userId),
            };
        } catch (error) {
            this.logger.error(
                `Failed to fetch notifications for user: ${userId}`,
                error instanceof Error ? error.message : String(error),
                'NotificationsService',
            );
            throw new InternalServerErrorException('Failed to fetch notifications');
        }
    }

    /**
     * Mark a single notification as read.
     * Verifies the notification belongs to the requesting user.
     */
    async markAsRead(notificationId: string, userId: string): Promise<NotificationResponse> {
        try {
            const notification = await this.databaseService.notification.findUnique({
                where: { id: notificationId },
            });

            if (!notification || notification.userId !== userId) {
                throw new NotFoundException('Notification not found');
            }

            if (notification.status === 'READ') {
                return { message: 'Notification already marked as read', notification };
            }

            const updated = await this.databaseService.notification.update({
                where: { id: notificationId },
                data: {
                    status: 'READ',
                    readAt: new Date(),
                },
            });

            this.logger.log(
                `Notification ${notificationId} marked as read for user: ${userId}`,
                'NotificationsService',
            );

            return { message: 'Notification marked as read', notification: updated };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Failed to mark notification ${notificationId} as read`,
                error instanceof Error ? error.message : String(error),
                'NotificationsService',
            );
            throw new InternalServerErrorException('Failed to mark notification as read');
        }
    }

    /**
     * Mark all unread notifications as read for the authenticated user.
     */
    async markAllAsRead(userId: string): Promise<{ message: string; updatedCount: number }> {
        try {
            const result = await this.databaseService.notification.updateMany({
                where: { userId, status: 'UNREAD' },
                data: {
                    status: 'READ',
                    readAt: new Date(),
                },
            });

            this.logger.log(
                `Marked ${result.count} notifications as read for user: ${userId}`,
                'NotificationsService',
            );

            return { message: 'All notifications marked as read', updatedCount: result.count };
        } catch (error) {
            this.logger.error(
                `Failed to mark all notifications as read for user: ${userId}`,
                error instanceof Error ? error.message : String(error),
                'NotificationsService',
            );
            throw new InternalServerErrorException('Failed to mark all notifications as read');
        }
    }

    /**
     * Delete (dismiss) a single notification.
     * Verifies the notification belongs to the requesting user.
     */
    async remove(notificationId: string, userId: string): Promise<NotificationDeletedResponse> {
        try {
            const notification = await this.databaseService.notification.findUnique({
                where: { id: notificationId },
            });

            if (!notification || notification.userId !== userId) {
                throw new NotFoundException('Notification not found');
            }

            await this.databaseService.notification.delete({
                where: { id: notificationId },
            });

            this.logger.log(
                `Notification ${notificationId} deleted for user: ${userId}`,
                'NotificationsService',
            );

            return { message: 'Notification deleted successfully' };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            this.logger.error(
                `Failed to delete notification ${notificationId}`,
                error instanceof Error ? error.message : String(error),
                'NotificationsService',
            );
            throw new InternalServerErrorException('Failed to delete notification');
        }
    }

    // ==================== Push Helpers ====================

    /**
     * Sends a single push notification via Expo's push API.
     *
     * The `data` object is passed through to the Expo notification payload
     * and is accessible in the app via the notification response object.
     * Include notificationId so the app can mark it as read on tap.
     */
    private async sendExpoPush(
        expoPushToken: string,
        title: string,
        body: string,
        data?: Record<string, unknown>,
    ): Promise<void> {
        const message = {
            to: expoPushToken,
            sound: 'default',
            title,
            body,
            data: data ?? {},
            priority: 'high',
        };

        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(message),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Expo push API responded with ${response.status}: ${text}`);
        }

        const result = (await response.json()) as { data: { status: string; message?: string } };

        if (result.data?.status === 'error') {
            throw new Error(`Expo push error: ${result.data.message ?? 'unknown'}`);
        }

        this.logger.log(
            `Expo push sent to token ${expoPushToken.slice(0, 20)}...`,
            'NotificationsService',
        );
    }

    // ==================== Helpers ====================

    private async getUnreadCount(userId: string): Promise<number> {
        return this.databaseService.notification.count({
            where: { userId, status: 'UNREAD' },
        });
    }
}
