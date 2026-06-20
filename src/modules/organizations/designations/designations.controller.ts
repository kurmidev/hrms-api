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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DesignationsService } from './designations.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { DesignationQueryDto } from './dto/designation-query.dto';
import { DesignationResponseDto } from './dto/designation-response.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('designations')
export class DesignationsController {
  constructor(private readonly designationsService: DesignationsService) {}

  @Get('trash')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List soft-deleted designations' })
  @ApiResponse({ status: 200, description: 'Trashed designations' })
  findTrashed(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.designationsService.findTrashed(organizationId, pagination);
  }

  @Get('for-assignment')
  @RequirePermissions('employee:read')
  @ApiOperation({
    summary: 'Get designations for employee assignment',
    description: 'Returns all active designations ordered by department hierarchy level, then seniority level. Use this for employee onboarding forms.',
  })
  @ApiResponse({ status: 200, description: 'Ordered designations for assignment', type: [DesignationResponseDto] })
  findForAssignment(@CurrentUser('organizationId') organizationId: string) {
    return this.designationsService.findForAssignment(organizationId);
  }

  @Post()
  @RequirePermissions('employee:create')
  @ApiOperation({ summary: 'Create designation', description: 'Creates a job designation linked to a department. Level 1 = most senior.' })
  @ApiResponse({ status: 201, description: 'Designation created', type: DesignationResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or department not found' })
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateDesignationDto,
  ) {
    return this.designationsService.create(organizationId, dto);
  }

  @Get()
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List designations', description: 'Paginated list ordered by level (most senior first). Filter by ?departmentId=...' })
  @ApiResponse({ status: 200, description: 'Designations list' })
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: DesignationQueryDto,
  ) {
    return this.designationsService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'Get designation by ID' })
  @ApiParam({ name: 'id', description: 'Designation UUID' })
  @ApiResponse({ status: 200, description: 'Designation details', type: DesignationResponseDto })
  @ApiResponse({ status: 404, description: 'Designation not found' })
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.designationsService.findOne(organizationId, id);
  }

  @Put(':id')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Update designation', description: 'Updates name, department, level, or linked payroll structure.' })
  @ApiParam({ name: 'id', description: 'Designation UUID' })
  @ApiResponse({ status: 200, description: 'Designation updated', type: DesignationResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or department not found' })
  @ApiResponse({ status: 404, description: 'Designation not found' })
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDesignationDto,
  ) {
    return this.designationsService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:delete')
  @ApiOperation({ summary: 'Soft-delete designation', description: 'Soft-deletes. Fails if employees are assigned to it.' })
  @ApiParam({ name: 'id', description: 'Designation UUID' })
  @ApiResponse({ status: 200, description: 'Designation soft-deleted' })
  @ApiResponse({ status: 400, description: 'Designation has assigned employees' })
  @ApiResponse({ status: 404, description: 'Designation not found' })
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.designationsService.remove(organizationId, id);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Restore soft-deleted designation' })
  @ApiParam({ name: 'id', description: 'Designation UUID' })
  @ApiResponse({ status: 200, description: 'Designation restored', type: DesignationResponseDto })
  @ApiResponse({ status: 404, description: 'Deleted designation not found' })
  restore(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.designationsService.restore(organizationId, id);
  }
}
