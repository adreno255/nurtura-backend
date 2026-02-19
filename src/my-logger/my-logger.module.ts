import { Module, Global } from '@nestjs/common';
import { MyLoggerService } from './my-logger.service';

@Global()
@Module({
    providers: [MyLoggerService],
    exports: [MyLoggerService],
})
export class MyLoggerModule {}
