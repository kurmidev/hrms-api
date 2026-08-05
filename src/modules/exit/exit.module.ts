import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AssetsModule } from '../assets/assets.module';
import { LoansModule } from '../loans/loans.module';
import { EmployeesModule } from '../employees/employees.module';
import { ExitController } from './exit.controller';
import { ExitService } from './exit.service';

@Module({
  imports: [PrismaModule, AssetsModule, LoansModule, EmployeesModule],
  controllers: [ExitController],
  providers: [ExitService],
  exports: [ExitService],
})
export class ExitModule {}
