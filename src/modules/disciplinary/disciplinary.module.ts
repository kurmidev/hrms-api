import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DisciplinaryController } from './disciplinary.controller';
import { DisciplinaryService } from './disciplinary.service';

@Module({
  imports: [PrismaModule],
  controllers: [DisciplinaryController],
  providers: [DisciplinaryService],
  exports: [DisciplinaryService],
})
export class DisciplinaryModule {}
