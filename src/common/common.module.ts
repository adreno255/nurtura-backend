import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { FirebaseJwtStrategy } from './strategies/firebase-jwt.strategy';
import { FirebaseModule } from '../firebase/firebase.module';
import { MyLoggerModule } from '../my-logger/my-logger.module';

@Global()
@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'firebase-jwt' }),
        FirebaseModule,
        MyLoggerModule,
    ],
    providers: [FirebaseJwtStrategy],
    exports: [FirebaseJwtStrategy, PassportModule],
})
export class CommonModule {}
