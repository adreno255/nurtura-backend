import { type HttpStatus } from '@nestjs/common';

export interface ExceptionResponse {
    statusCode: HttpStatus;
    timestamp: string;
    path: string;
    message: string;
}
