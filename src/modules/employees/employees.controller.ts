import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PatchEmployeeStatusDto } from './dto/patch-employee-status.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('trash')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List soft-deleted employees' })
  findTrashed(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: EmployeeQueryDto,
  ) {
    return this.employeesService.findTrashed(organizationId, query);
  }

  @Post()
  @RequirePermissions('employee:create')
  @ApiOperation({ summary: 'Create employee directly (bypasses onboarding)', description: 'Creates Employee + User in a single transaction with temp password.' })
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(organizationId, dto, userId);
  }

  @Get()
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List employees', description: 'Paginated. Filter by ?status=ACTIVE&departmentId=...' })
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: EmployeeQueryDto,
  ) {
    return this.employeesService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'Get employee detail' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.employeesService.findOne(organizationId, id);
  }

  @Put(':id')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Update employee fields' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  update(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(organizationId, id, dto, userId);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Change employee status', description: 'Valid transitions: PRE_BOARDING→ACTIVE, ACTIVE→ON_LEAVE/SUSPENDED/EXITED.' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  patchStatus(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: PatchEmployeeStatusDto,
  ) {
    return this.employeesService.patchStatus(organizationId, id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:delete')
  @ApiOperation({ summary: 'Soft-delete employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.employeesService.remove(organizationId, id, userId);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Restore soft-deleted employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  restore(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.employeesService.restore(organizationId, id, userId);
  }
}
