import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../../prisma/prisma.module';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';
import { NoticesScheduler } from './notices.scheduler';

@Module({
  imports: [PrismaModule, MulterModule.register({ storage: memoryStorage() })],
  controllers: [NoticesController],
  providers: [NoticesService, NoticesScheduler],
  exports: [NoticesService],
})
export class NoticesModule {}
