import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiNotFoundResponse,
    ApiInternalServerErrorResponse,
    ApiBadRequestResponse,
    ApiParam,
} from '@nestjs/swagger';
import { AutomationService } from './automation.service';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto } from './dto';
import { CurrentUser } from '../common/decorators';
import { type CurrentUserPayload } from '../common/interfaces';

@ApiTags('Automation')
@ApiBearerAuth('firebase-jwt')
@Controller('automation')
export class AutomationController {
    constructor(private readonly automationService: AutomationService) {}

    @Post('rules')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create an automation rule',
        description: 'Creates a new automation rule for a rack with conditions and actions',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Automation rule created successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Automation rule created successfully' },
                rule: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clx123abc456' },
                        name: { type: 'string', example: 'Auto-water when dry' },
                        description: {
                            type: 'string',
                            example: 'Waters plants when soil moisture is low',
                        },
                        conditions: {
                            type: 'object',
                            example: { moisture: { lessThan: 30 } },
                        },
                        actions: {
                            type: 'object',
                            example: { watering: { action: 'start', duration: 5000 } },
                        },
                        cooldownMinutes: { type: 'number', example: 30 },
                        isEnabled: { type: 'boolean', example: true },
                    },
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid input data or validation error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/automation/rules' },
                message: { type: 'string', example: 'At least one condition must be specified' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/automation/rules' },
                message: { type: 'string', example: 'Rack not found' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/automation/rules' },
                message: { type: 'string', example: 'Failed to create automation rule' },
            },
        },
    })
    async createRule(
        @CurrentUser() user: CurrentUserPayload,
        @Body() body: CreateAutomationRuleDto,
    ) {
        return this.automationService.createRule(user.dbId, body);
    }

    @Get('racks/:rackId/rules')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get all automation rules for a rack',
        description: 'Retrieves all automation rules configured for a specific rack',
    })
    @ApiParam({
        name: 'rackId',
        required: true,
        type: String,
        description: 'Rack ID',
        example: 'clx123abc456',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Automation rules retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'clx789xyz123' },
                    rackId: { type: 'string', example: 'clx123abc456' },
                    name: { type: 'string', example: 'Auto-water when dry' },
                    description: { type: 'string', example: 'Waters plants when moisture is low' },
                    conditions: { type: 'object', example: { moisture: { lessThan: 30 } } },
                    actions: {
                        type: 'object',
                        example: { watering: { action: 'start', duration: 5000 } },
                    },
                    cooldownMinutes: { type: 'number', example: 30 },
                    isEnabled: { type: 'boolean', example: true },
                    lastTriggeredAt: { type: 'string', example: '2025-02-01T14:30:00.000Z' },
                    triggerCount: { type: 'number', example: 15 },
                },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Rack not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/automation/racks/clx123abc456/rules' },
                message: { type: 'string', example: 'Rack not found' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/automation/racks/clx123abc456/rules' },
                message: { type: 'string', example: 'Failed to retrieve automation rules' },
            },
        },
    })
    async getRackRules(@Param('rackId') rackId: string, @CurrentUser() user: CurrentUserPayload) {
        return this.automationService.getRackRules(rackId, user.dbId);
    }

    @Put('rules/:ruleId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update an automation rule',
        description: 'Updates an existing automation rule',
    })
    @ApiParam({
        name: 'ruleId',
        required: true,
        type: String,
        description: 'Automation rule ID',
        example: 'clx789xyz123',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Automation rule updated successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Automation rule updated successfully' },
                rule: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clx789xyz123' },
                        name: { type: 'string', example: 'Updated rule name' },
                        description: { type: 'string', example: 'Updated description' },
                        isEnabled: { type: 'boolean', example: false },
                    },
                },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Automation rule not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/automation/rules/clx789xyz123' },
                message: { type: 'string', example: 'Automation rule not found' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid update data',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/automation/rules/clx789xyz123' },
                message: {
                    type: 'string',
                    example: 'Moisture threshold must be between 0 and 100',
                },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/automation/rules/clx789xyz123' },
                message: { type: 'string', example: 'Failed to update automation rule' },
            },
        },
    })
    async updateRule(
        @Param('ruleId') ruleId: string,
        @CurrentUser() user: CurrentUserPayload,
        @Body() body: UpdateAutomationRuleDto,
    ) {
        return this.automationService.updateRule(ruleId, user.dbId, body);
    }

    @Delete('rules/:ruleId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Delete an automation rule',
        description: 'Deletes an automation rule',
    })
    @ApiParam({
        name: 'ruleId',
        required: true,
        type: String,
        description: 'Automation rule ID',
        example: 'clx789xyz123',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Automation rule deleted successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Automation rule deleted successfully' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: 'Automation rule not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/automation/rules/clx789xyz123' },
                message: { type: 'string', example: 'Automation rule not found' },
            },
        },
    })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                timestamp: { type: 'string', example: '2025-12-27T10:30:00.000Z' },
                path: { type: 'string', example: '/api/automation/rules/clx789xyz123' },
                message: { type: 'string', example: 'Failed to delete automation rule' },
            },
        },
    })
    async deleteRule(@Param('ruleId') ruleId: string, @CurrentUser() user: CurrentUserPayload) {
        return this.automationService.deleteRule(ruleId, user.dbId);
    }
}
