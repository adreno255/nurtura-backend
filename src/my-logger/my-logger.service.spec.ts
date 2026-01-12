import { Test, type TestingModule } from '@nestjs/testing';
import { MyLoggerService } from './my-logger.service';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock fs.promises
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn(),
        appendFile: jest.fn(),
    },
}));

describe('MyLoggerService', () => {
    let service: MyLoggerService;
    const mockMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
    const mockAppendFile = fs.appendFile as jest.MockedFunction<typeof fs.appendFile>;

    beforeEach(async () => {
        // Clear mocks before each test
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [MyLoggerService],
        }).compile();

        service = module.get<MyLoggerService>(MyLoggerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('log', () => {
        it('should write log message to app.log file', async () => {
            const message = 'Test log message';
            const context = 'TestContext';

            service.log(message, context);

            // Wait for async file write
            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.stringContaining('app.log'),
                expect.stringContaining(message),
            );
            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining(context),
            );
        });

        it('should handle log without context', async () => {
            const message = 'Test log without context';

            service.log(message);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.stringContaining('app.log'),
                expect.stringContaining(message),
            );
        });

        it('should format log with timestamp and context', async () => {
            const message = 'Formatted log';
            const context = 'FormatTest';

            service.log(message, context);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            const logContent = mockAppendFile.mock.calls[0][1] as string;

            // Should contain timestamp (date format)
            expect(logContent).toMatch(/\d{1,2}\/\d{1,2}\/\d{2},\s\d{1,2}:\d{2}:\d{2}\s(AM|PM)/);
            // Should contain context
            expect(logContent).toContain(context);
            // Should contain message
            expect(logContent).toContain(message);
            // Should end with newline
            expect(logContent).toMatch(/\n$/);
        });
    });

    describe('error', () => {
        it('should write error to error.log file', async () => {
            const message = 'Test error message';
            const stack = 'Error stack trace\nat line 1\nat line 2';
            const context = 'ErrorContext';

            service.error(message, stack, context);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.stringContaining('error.log'),
                expect.stringContaining(message),
            );
        });

        it('should include shortened stack trace in error log', async () => {
            const message = 'Stack test error';
            const stack = 'Error: Something went wrong\nat function1\nat function2';
            const context = 'StackTest';

            service.error(message, stack, context);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            const logContent = mockAppendFile.mock.calls[0][1] as string;

            // Should contain first line of stack
            expect(logContent).toContain('Error: Something went wrong');
            // Should NOT contain subsequent lines
            expect(logContent).not.toContain('at function2');
        });

        it('should handle error without stack', async () => {
            const message = 'Error without stack';
            const context = 'NoStackContext';

            service.error(message, undefined, context);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.stringContaining('error.log'),
                expect.stringContaining(message),
            );
        });
    });

    describe('warn', () => {
        it('should write warning to app.log file', async () => {
            const message = 'Test warning message';
            const context = 'WarnContext';

            service.warn(message, context);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.stringContaining('app.log'),
                expect.stringContaining(message),
            );
        });
    });

    describe('debug', () => {
        it('should write debug message to app.log file', async () => {
            const message = 'Test debug message';
            const context = 'DebugContext';

            service.debug(message, context);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.stringContaining('app.log'),
                expect.stringContaining(message),
            );
        });
    });

    describe('verbose', () => {
        it('should write verbose message to app.log file', async () => {
            const message = 'Test verbose message';
            const context = 'VerboseContext';

            service.verbose(message, context);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.stringContaining('app.log'),
                expect.stringContaining(message),
            );
        });
    });

    describe('bootstrap', () => {
        it('should write bootstrap message to bootstrap.log file', async () => {
            const message = 'Test bootstrap message';
            const context = 'BootstrapContext';

            service.bootstrap(message, context);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.stringContaining('bootstrap.log'),
                expect.stringContaining(message),
            );
        });

        it('should format bootstrap log correctly', async () => {
            const message = 'App starting';
            const context = 'Main';

            service.bootstrap(message, context);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            const logContent = mockAppendFile.mock.calls[0][1] as string;

            expect(logContent).toContain(message);
            expect(logContent).toContain(context);
            expect(logContent).toMatch(/\n$/);
        });
    });

    describe('file system operations', () => {
        it('should create log directory if it does not exist', async () => {
            const message = 'Test directory creation';

            service.log(message);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('logs'), {
                recursive: true,
            });
        });

        it('should handle file write errors gracefully', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            mockAppendFile.mockRejectedValueOnce(new Error('Write failed'));

            const message = 'Test error handling';

            service.log(message);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to write to log file:',
                expect.any(Error),
            );

            consoleErrorSpy.mockRestore();
        });

        it('should handle directory creation errors silently', async () => {
            mockMkdir.mockRejectedValueOnce(new Error('Directory exists'));

            const message = 'Test mkdir error';

            service.log(message);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            // Should still attempt to write file
            expect(mockAppendFile).toHaveBeenCalled();
        });
    });

    describe('message types', () => {
        it('should handle string messages', async () => {
            const message = 'String message';

            service.log(message);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining(message),
            );
        });

        it('should handle object messages', async () => {
            const message = { key: 'value', nested: { data: 'test' } };

            service.log(message);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            const logContent = mockAppendFile.mock.calls[0][1] as string;

            expect(logContent).toContain('[object Object]');
        });

        it('should handle number messages', async () => {
            const message = 12345;

            service.log(message);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            const logContent = mockAppendFile.mock.calls[0][1] as string;

            expect(logContent).toContain('12345');
        });

        it('should handle null/undefined messages', async () => {
            service.log(null as any);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            expect(mockAppendFile).toHaveBeenCalled();
        });
    });

    describe('log paths', () => {
        it('should use correct log directory', async () => {
            const message = 'Path test';

            service.log(message);

            await new Promise<void>((resolve) => process.nextTick(resolve));

            const logPath = mockAppendFile.mock.calls[0][0] as string;

            expect(logPath).toContain(path.join('logs', 'app.log'));
        });

        it('should write errors to separate file', async () => {
            service.error('Error message');

            await new Promise<void>((resolve) => process.nextTick(resolve));

            const errorLogPath = mockAppendFile.mock.calls[0][0] as string;

            expect(errorLogPath).toContain(path.join('logs', 'error.log'));
        });

        it('should write bootstrap logs to separate file', async () => {
            service.bootstrap('Bootstrap message');

            await new Promise<void>((resolve) => process.nextTick(resolve));

            const bootstrapLogPath = mockAppendFile.mock.calls[0][0] as string;

            expect(bootstrapLogPath).toContain(path.join('logs', 'bootstrap.log'));
        });
    });
});
