import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { OdController } from './od/od.controller';
import { OdService } from './od/od.service';

@Module({
  imports: [PrismaModule, OrganizationsModule, MulterModule.register({ storage: memoryStorage() })],
  // NOTE: OdController is registered BEFORE AttendanceController so that
  // GET /attendance/od is matched ahead of AttendanceController's GET /attendance/:id
  // (id="od" collision risk).
  controllers: [OdController, AttendanceController],
  providers: [AttendanceService, OdService],
  exports: [AttendanceService, OdService],
})
export class AttendanceModule {}
