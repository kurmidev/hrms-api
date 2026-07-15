import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { OnboardingController } from './onboarding/onboarding.controller';
import { OnboardingPublicController } from './onboarding/onboarding-public.controller';
import { OnboardingService } from './onboarding/onboarding.service';
import { OnboardingScheduler } from './onboarding/onboarding.scheduler';
import { OnboardingProcessor } from './jobs/onboarding.processor';
import { EmployeesProcessor } from './jobs/employees.processor';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'onboarding' }),
    BullModule.registerQueue({ name: 'employees' }),
    MulterModule.register({ storage: memoryStorage() }),
    ChatModule,
  ],
  controllers: [EmployeesController, OnboardingController, OnboardingPublicController],
  providers: [
    EmployeesService,
    OnboardingService,
    OnboardingScheduler,
    OnboardingProcessor,
    EmployeesProcessor,
  ],
  exports: [EmployeesService, OnboardingService],
})
export class EmployeesModule {}
