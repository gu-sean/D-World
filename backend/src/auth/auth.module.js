import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PhoneVerificationService } from './phone-verification.service.js';
import { createSmsSender, SMS_SENDER } from './sms/sms-sender.js';
import { SocialVerifierService } from './social/social-verifier.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PhoneVerificationService,
    SocialVerifierService,
    {
      provide: SMS_SENDER,
      useFactory: createSmsSender,
      inject: [ConfigService],
    },
  ],
})
export class AuthModule {}
