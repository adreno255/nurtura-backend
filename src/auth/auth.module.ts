import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpController } from './otp/otp.controller';
import { OtpService } from './otp/otp.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [FirebaseModule, DatabaseModule, EmailModule],
    controllers: [AuthController, OtpController],
    providers: [AuthService, OtpService],
    exports: [AuthService, OtpService],
})
export class AuthModule {}
