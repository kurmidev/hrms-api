import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GreenThanksController } from './green-thanks.controller';
import { GreenThanksService } from './green-thanks.service';
import { GreenThanksConfigController } from './green-thanks-config.controller';
import { GreenThanksConfigService } from './green-thanks-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [GreenThanksConfigController, GreenThanksController],
  providers: [GreenThanksService, GreenThanksConfigService],
  exports: [GreenThanksService],
})
export class GreenThanksModule {}
