import { Test, type TestingModule } from '@nestjs/testing';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import { type ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { PrismaClientValidationError } from '@prisma/client/runtime/client';
import { createMockLogger } from '../../../test/mocks';

// Mock the Prisma Error since we can't always instantiate the real one easily in tests
// depending on the Prisma version/environment
jest.mock('@prisma/client/runtime/client', () => {
    return {
        PrismaClientValidationError: class extends Error {
            constructor(message: string) {
                super(message);
                this.name = 'PrismaClientValidationError';
            }
        },
    };
});

describe('AllExceptionsFilter', () => {
    let filter: AllExceptionsFilter;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockArgumentsHost: Partial<ArgumentsHost>;
    let mockStatus: jest.Mock;
    let mockJson: jest.Mock;

    const mockLoggerService = createMockLogger();

    beforeEach(async () => {
        jest.clearAllMocks();

        mockStatus = jest.fn().mockReturnThis();
        mockJson = jest.fn();

        mockRequest = {
            url: '/test/url',
        };

        mockResponse = {
            status: mockStatus,
            json: mockJson,
        } as unknown as Response;

        mockArgumentsHost = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: () => mockRequest,
                getResponse: () => mockResponse,
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AllExceptionsFilter,
                {
                    provide: MyLoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(filter).toBeDefined();
    });

    describe('HttpException Handling', () => {
        it('should handle simple string HttpExceptions', () => {
            const exception = new HttpException('Forbidden Access', HttpStatus.FORBIDDEN);

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            // 1. Check Response Status
            expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);

            // 2. Check Response JSON
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    statusCode: HttpStatus.FORBIDDEN,
                    message: 'Forbidden Access',
                    path: '/test/url',
                }),
            );

            // 3. Check Logger
            expect(mockLoggerService.error).toHaveBeenCalled();
        });

        it('should handle HttpException with object response', () => {
            const responseObj = { message: 'Not Found Custom', error: 'Not Found' };
            const exception = new HttpException(responseObj, HttpStatus.NOT_FOUND);

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Not Found Custom',
                }),
            );
        });

        it('should join array messages (Validation Pipe format)', () => {
            // NestJS ValidationPipe often returns: { message: ['email is invalid', 'name is empty'] }
            const validationResponse = {
                message: ['email must be an email', 'password is too short'],
                error: 'Bad Request',
                statusCode: 400,
            };
            const exception = new HttpException(validationResponse, HttpStatus.BAD_REQUEST);

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'email must be an email, password is too short',
                    statusCode: HttpStatus.BAD_REQUEST,
                }),
            );
        });
    });

    describe('PrismaClientValidationError Handling', () => {
        it('should catch PrismaClientValidationError and format it', () => {
            // Newlines should be replaced by spaces based on your regex
            const rawMessage = 'Invalid \n value provided \n for field';
            const exception = new PrismaClientValidationError(rawMessage, {
                clientVersion: '7.3.0',
            });

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);

            // Check regex replacement
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
                    message: 'Invalid   value provided   for field',
                }),
            );

            // Verify Logger payload
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                expect.any(String), // The JSON string
                expect.any(String), // The stack trace
                'AllExceptionsFilter',
            );
        });
    });

    describe('Unknown/Generic Error Handling', () => {
        it('should default to 500 Internal Server Error for generic errors', () => {
            const exception = new Error('Something crashed violently');

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    message: 'Internal Server Error', // Default message
                }),
            );
        });

        it('should handle non-Error objects thrown', () => {
            const exception = { some: 'random object thrown' };

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Internal Server Error',
                }),
            );
        });
    });
});
