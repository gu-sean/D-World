import { Module } from '@nestjs/common';
import { UserBillingController } from './user-billing.controller.js';

@Module({ controllers: [UserBillingController] })
export class UserBillingModule {}
