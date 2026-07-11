import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { PlatformJwtAuthGuard } from '../platform-auth/platform-jwt-auth.guard';
import { SubscriptionPlansService } from './subscription-plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';

@Public()
@ApiTags('Platform Plans')
@Controller('platform/plans')
export class SubscriptionPlansController {
  constructor(private readonly service: SubscriptionPlansService) {}

  @Public()
  @Get()
  findAll(@Query('all') all?: string) {
    return this.service.findAll(all === 'true');
  }

  @ApiBearerAuth()
  @UseGuards(PlatformJwtAuthGuard)
  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.service.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(PlatformJwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreatePlanDto>) {
    return this.service.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(PlatformJwtAuthGuard)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}
