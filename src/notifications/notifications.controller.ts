import {
    Controller,
    Get,
    Patch,
    Delete,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    Post,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
    ApiUnauthorizedResponse,
    ApiNotFoundResponse,
    ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, Public } from '../common/decorators';
import { type CurrentUserPayload } from '../common/interfaces';
import { type PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { CreateNotificationPayload } from './interfaces/notification.interface';
import { NotificationType } from '../generated/prisma';

@ApiTags('Notifications')
@ApiBearerAuth('firebase-jwt')
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get notifications for the authenticated user',
        description: 'Returns a paginated list of notifications. Optionally filter to unread only.',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number (1-based)',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Number of items per page',
        example: 10,
    })
    @ApiQuery({
        name: 'unreadOnly',
        required: false,
        type: Boolean,
        description: 'If true, returns only unread notifications',
        example: false,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Notifications retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', example: 'clx123abc456' },
                            userId: { type: 'string', example: 'clx789xyz' },
                            rackId: { type: 'string', nullable: true, example: 'clx456def' },
                            type: {
                                type: 'string',
                                enum: ['SYSTEM', 'ALERT', 'WARNING', 'INFO', 'SUCCESS'],
                                example: 'ALERT',
                            },
                            status: {
                                type: 'string',
                                enum: ['UNREAD', 'READ', 'ARCHIVED'],
                                example: 'UNREAD',
                            },
                            title: { type: 'string', example: 'Low Soil Moisture' },
                            message: {
                                type: 'string',
                                example: 'Soil moisture has dropped below 30%',
                            },
                            metadata: { type: 'object', nullable: true },
                            readAt: {
                                type: 'string',
                                format: 'date-time',
                                nullable: true,
                                example: null,
                            },
                            createdAt: {
                                type: 'string',
                                format: 'date-time',
                                example: '2026-01-15T08:00:00.000Z',
                            },
                            updatedAt: {
                                type: 'string',
                                format: 'date-time',
                                example: '2026-01-15T08:00:00.000Z',
                            },
                        },
                    },
                },
                meta: {
                    type: 'object',
                    properties: {
                        currentPage: { type: 'number', example: 1 },
                        itemsPerPage: { type: 'number', example: 10 },
                        totalItems: { type: 'number', example: 25 },
                        totalPages: { type: 'number', example: 3 },
                        hasNextPage: { type: 'boolean', example: true },
                        hasPreviousPage: { type: 'boolean', example: false },
                    },
                },
                unreadCount: { type: 'number', example: 5 },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid authentication token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications' },
                message: { type: 'string', example: 'Failed to fetch notifications' },
            },
        },
    })
    async findAll(
        @CurrentUser() user: CurrentUserPayload,
        @Query() query: PaginationQueryDto,
        @Query('unreadOnly') unreadOnly?: boolean,
    ) {
        return this.notificationsService.findAll(user.dbId, query, unreadOnly);
    }

    @Get('has-unread')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Check if a user has unread notifications',
        description: 'Checks if a user has any unread notifications.',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User has unread notifications',
        schema: {
            type: 'object',
            properties: {
                hasUnread: { type: 'boolean', example: true },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid authentication token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications/has-unread' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications/has-unread' },
                message: { type: 'string', example: 'Failed to check unread notifications' },
            },
        },
    })
    async hasUnreadNotifications(@CurrentUser() user: CurrentUserPayload) {
        return this.notificationsService.hasUnreadNotifications(user.dbId);
    }

    @Patch(':notificationId/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Mark a notification as read',
        description: 'Marks a single notification as read. Only the owner can mark it.',
    })
    @ApiParam({
        name: 'notificationId',
        description: 'Notification ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Notification marked as read',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Notification marked as read' },
                notification: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clx123abc456' },
                        status: { type: 'string', example: 'READ' },
                        readAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2026-01-15T08:05:00.000Z',
                        },
                    },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid authentication token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications/clx123abc456/read' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Notification not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications/clx123abc456/read' },
                message: { type: 'string', example: 'Notification not found' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications/clx123abc456/read' },
                message: { type: 'string', example: 'Failed to mark notification as read' },
            },
        },
    })
    async markAsRead(
        @Param('notificationId') notificationId: string,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        return this.notificationsService.markAsRead(notificationId, user.dbId);
    }

    @Patch('read-all')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Mark all notifications as read',
        description: 'Marks all unread notifications as read for the authenticated user.',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'All notifications marked as read',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'All notifications marked as read' },
                updatedCount: { type: 'number', example: 5 },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid authentication token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications/read-all' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications/read-all' },
                message: { type: 'string', example: 'Failed to mark all notifications as read' },
            },
        },
    })
    async markAllAsRead(@CurrentUser() user: CurrentUserPayload) {
        return this.notificationsService.markAllAsRead(user.dbId);
    }

    @Delete(':notificationId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Delete a notification',
        description: 'Permanently deletes a notification. Only the owner can delete it.',
    })
    @ApiParam({
        name: 'notificationId',
        description: 'Notification ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Notification deleted successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Notification deleted successfully' },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Missing or invalid authentication token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications/clx123abc456' },
                message: { type: 'string', example: 'Authentication required' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Notification not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications/clx123abc456' },
                message: { type: 'string', example: 'Notification not found' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2026-01-15T08:00:00.000Z' },
                path: { type: 'string', example: '/notifications/clx123abc456' },
                message: { type: 'string', example: 'Failed to delete notification' },
            },
        },
    })
    async remove(
        @Param('notificationId') notificationId: string,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        return this.notificationsService.remove(notificationId, user.dbId);
    }

    @Post('send-test')
    @Public()
    async sendTestNotification() {
        const payload = {
            userId: 'cmnu23f0v000228uuun4dsmy3',
            rackId: 'cmnr7b0ku0000k0uu1dtss97i',
            type: NotificationType.INFO,
            title: 'Test Notification',
            message: 'This is a test notification from the API',
            metadata: {
                screen: '/(tabs)/(account)/user-info',
                firebaseUid: '99us9vHHLDbxXbkWCjrJOaKgaLd2',
                email: 'nimo.neoisaiahbscs2023@gmail.com',
            },
        } as CreateNotificationPayload;

        await this.notificationsService.handleCreateNotification(payload);
        return { message: 'Test notification sent' };
    }
}
