import { Controller, Post, Get, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { PlatformJwtAuthGuard } from '../platform-auth/platform-jwt-auth.guard';
import { PlatformOrganizationsService } from './platform-organizations.service';
import {
  RegisterOrganizationDto,
  UpdateOrganizationDto,
  UpdateSubscriptionDto,
} from './dto/register-organization.dto';

@Public()
@ApiTags('Platform Organizations')
@ApiBearerAuth()
@UseGuards(PlatformJwtAuthGuard)
@Controller('platform/organizations')
export class PlatformOrganizationsController {
  constructor(private readonly service: PlatformOrganizationsService) {}

  @Post()
  register(@Body() dto: RegisterOrganizationDto, @Request() req) {
    return this.service.registerOrganization(dto, req.user.id);
  }

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findAll(Number(page) || 1, Number(limit) || 20);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.service.updateOrg(id, dto);
  }

  @Put(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.service.suspend(id);
  }

  @Put(':id/activate')
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Put(':id/subscription')
  updateSubscription(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.service.updateSubscription(id, dto);
  }
}
