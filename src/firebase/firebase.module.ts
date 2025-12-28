import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseService } from './firebase.service';
import { MyLoggerModule } from '../my-logger/my-logger.module';

@Global()
@Module({
    imports: [ConfigModule, MyLoggerModule],
    providers: [FirebaseService],
    exports: [FirebaseService],
})
export class FirebaseModule {}
