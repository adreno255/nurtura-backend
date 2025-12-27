import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { tap } from 'rxjs/operators';
import { MyLoggerService } from '../../my-logger/my-logger.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
    constructor(private readonly logger: MyLoggerService) {}

    intercept(context: ExecutionContext, next: CallHandler) {
        const httpCtx = context.switchToHttp();
        const req = httpCtx.getRequest<Request>();

        const controller = context.getClass().name;
        const handler = context.getHandler().name;

        const { method, url } = req;
        const start = Date.now();

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - start;
                this.logger.log(`${method} ${url} ${duration}ms`, `${controller}.${handler}`);
            }),
        );
    }
}
