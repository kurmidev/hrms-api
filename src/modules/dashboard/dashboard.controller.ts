import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';

@ApiTags('Dashboards')
@ApiBearerAuth()
@Controller('dashboards')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  findForUser(@Request() req) {
    const { id, organizationId } = req.user;
    const roleName = req.user.permissions?.includes('*') ? 'super_admin' : 'employee';
    return this.service.findForUser(id, organizationId, roleName);
  }

  @Get('defaults')
  findDefaults(@Request() req) {
    return this.service.findDefaults(req.user.organizationId);
  }

  @Post()
  create(@Body() dto: CreateDashboardDto, @Request() req) {
    return this.service.create(dto, req.user.id, req.user.organizationId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDashboardDto, @Request() req) {
    return this.service.update(id, dto, req.user.id, req.user.organizationId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.service.delete(id, req.user.id, req.user.organizationId);
  }

  @Post('seed-defaults')
  seedDefaults(@Request() req) {
    return this.service.seedDefaults(req.user.organizationId);
  }
}
