import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { BillingScheduler } from './billing.scheduler';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [InvoicesController],
  providers: [InvoicesService, BillingScheduler],
  exports: [InvoicesService],
})
export class InvoicesModule {}
