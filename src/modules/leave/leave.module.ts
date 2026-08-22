import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LeaveController } from './leave.controller';
import { LeavePoliciesService } from './leave-policies.service';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveApplicationsService } from './leave-applications.service';
import { HolidaysService } from './holidays.service';
import { GlobalLeaveService } from './global-leave.service';

@Module({
  imports: [PrismaModule],
  controllers: [LeaveController],
  providers: [
    LeavePoliciesService,
    LeaveBalanceService,
    LeaveApplicationsService,
    HolidaysService,
    GlobalLeaveService,
  ],
  exports: [
    LeavePoliciesService,
    LeaveBalanceService,
    LeaveApplicationsService,
    HolidaysService,
    GlobalLeaveService,
  ],
})
export class LeaveModule {}
