import { Injectable, ConsoleLogger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class MyLoggerService extends ConsoleLogger {
    private readonly logDir = path.resolve(process.cwd(), 'logs');
    private readonly appLog = path.join(this.logDir, 'app.log');
    private readonly errorLog = path.join(this.logDir, 'error.log');

    private async ensureLogDir(): Promise<void> {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            // Directory might already exist, ignore error
        }
    }

    private format(message: unknown, context?: string): string {
        const timestamp = new Intl.DateTimeFormat('en-US', {
            dateStyle: 'short',
            timeStyle: 'medium',
            timeZone: 'Asia/Manila',
        }).format(new Date());

        return `${timestamp}\t${context ?? 'App'}\t${String(message)}\n`;
    }

    private async writeToFile(filePath: string, content: string): Promise<void> {
        try {
            await this.ensureLogDir();
            await fs.appendFile(filePath, content);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    log(message: unknown, context?: string): void {
        void this.writeToFile(this.appLog, this.format(message, context));
        super.log(message, context);
    }

    error(message: unknown, stack?: string, context?: string): void {
        const errorMessage = stack ? `${String(message)}\n${stack}` : String(message);
        void this.writeToFile(this.errorLog, this.format(errorMessage, context));
        super.error(message, stack, context);
    }

    warn(message: unknown, context?: string): void {
        void this.writeToFile(this.appLog, this.format(message, context));
        super.warn(message, context);
    }

    debug(message: unknown, context?: string): void {
        void this.writeToFile(this.appLog, this.format(message, context));
        super.debug(message, context);
    }

    verbose(message: unknown, context?: string): void {
        void this.writeToFile(this.appLog, this.format(message, context));
        super.verbose(message, context);
    }
}
