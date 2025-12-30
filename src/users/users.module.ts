import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../database/database.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { MyLoggerModule } from '../my-logger/my-logger.module';

@Module({
    imports: [CommonModule, DatabaseModule, FirebaseModule, MyLoggerModule],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule {}
