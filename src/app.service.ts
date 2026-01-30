import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AppService {
    constructor(private readonly config: ConfigService) {}

    getStatus() {
        type PackageJson = {
            version: string;
        };

        function readPackageVersion(): string {
            try {
                const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf-8');
                const pkg = JSON.parse(raw) as PackageJson;
                return pkg.version ?? 'unknown';
            } catch {
                return 'unknown';
            }
        }
        return {
            name: 'Nurtura API Server',
            status: 'ok',
            environment: this.config.get<string>('NODE_ENV') ?? 'development',
            version: readPackageVersion(),
        };
    }
}
