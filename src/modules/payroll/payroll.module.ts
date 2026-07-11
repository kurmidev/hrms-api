import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoansModule } from '../loans/loans.module';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

// NOTE: processRun currently executes inline within initiateRun (see
// PayrollService.initiateRun TODO). A BullMQ 'payroll' queue + 'payroll.process'
// job (payload { organizationId, runId }) should be wired here — following the
// EmployeesModule pattern (BullModule.registerQueue + a PayrollProcessor
// @Processor('payroll')) — once async processing is needed for larger orgs.
@Module({
  imports: [PrismaModule, LoansModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
