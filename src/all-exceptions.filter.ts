import { Catch, ArgumentsHost, HttpStatus, HttpException, Injectable } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';
import { MyLoggerService } from './my-logger/my-logger.service';
import { PrismaClientValidationError } from '@prisma/client/runtime/client';

@Catch()
@Injectable()
export class AllExceptionsFilter extends BaseExceptionFilter {
    constructor(private readonly logger: MyLoggerService) {
        super();
    }

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        let responseBody: string | object = 'Internal Server Error';

        if (exception instanceof HttpException) {
            statusCode = exception.getStatus();
            responseBody = exception.getResponse();
        } else if (exception instanceof PrismaClientValidationError) {
            statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
            responseBody = exception.message.replace(/\n/g, ' ');
        }

        const errorPayload = {
            statusCode,
            timestamp: new Date().toISOString(),
            path: request.url,
            response: responseBody,
        };

        this.logger.error(
            JSON.stringify(errorPayload),
            exception instanceof Error ? exception.stack : undefined,
            'AllExceptionsFilter',
        );

        response.status(statusCode).json(errorPayload);
    }
}
