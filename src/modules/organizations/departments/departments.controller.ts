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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { MoveDepartmentDto } from './dto/move-department.dto';
import { DepartmentResponseDto, DepartmentTreeNodeDto } from './dto/department-response.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @RequirePermissions('employee:create')
  @ApiOperation({ summary: 'Create department', description: 'Creates a new department, optionally nested under a parent.' })
  @ApiResponse({ status: 201, description: 'Department created', type: DepartmentResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:create' })
  @ApiResponse({ status: 409, description: 'Department name already exists' })
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(organizationId, dto);
  }

  @Get('trash')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List soft-deleted departments' })
  @ApiResponse({ status: 200, description: 'Trashed departments' })
  findTrashed(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.departmentsService.findTrashed(organizationId, pagination);
  }

  // NOTE: 'tree' route MUST be declared before ':id' to avoid NestJS treating "tree" as an id param
  @Get('tree')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'Get department tree', description: 'Returns the full department hierarchy as a nested tree. Root departments have parentId = null.' })
  @ApiResponse({ status: 200, description: 'Department tree', type: [DepartmentTreeNodeDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:read' })
  findTree(@CurrentUser('organizationId') organizationId: string) {
    return this.departmentsService.findTree(organizationId);
  }

  @Get()
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List departments', description: 'Paginated flat list of all departments, including parent info and counts.' })
  @ApiResponse({ status: 200, description: 'Departments list' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:read' })
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.departmentsService.findAll(organizationId, pagination);
  }

  @Get(':id')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'Get department by ID' })
  @ApiParam({ name: 'id', description: 'Department UUID' })
  @ApiResponse({ status: 200, description: 'Department details', type: DepartmentResponseDto })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:read' })
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.departmentsService.findOne(organizationId, id);
  }

  @Put(':id')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Update department', description: 'Updates department name, head, or parent. Circular hierarchy changes are rejected.' })
  @ApiParam({ name: 'id', description: 'Department UUID' })
  @ApiResponse({ status: 200, description: 'Department updated', type: DepartmentResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or circular hierarchy' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({ status: 409, description: 'Department name already exists' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:update' })
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(organizationId, id, dto);
  }

  @Patch(':id/move')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Move department', description: 'Moves a department to a new parent. Set newParentId to null to promote to root.' })
  @ApiParam({ name: 'id', description: 'Department UUID' })
  @ApiResponse({ status: 200, description: 'Department moved' })
  @ApiResponse({ status: 400, description: 'Circular hierarchy or parent not found' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:update' })
  move(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: MoveDepartmentDto,
  ) {
    return this.departmentsService.move(organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:delete')
  @ApiOperation({ summary: 'Soft-delete department', description: 'Soft-deletes a department. Fails if it has employees, active sub-departments, or active designations.' })
  @ApiParam({ name: 'id', description: 'Department UUID' })
  @ApiResponse({ status: 200, description: 'Department soft-deleted' })
  @ApiResponse({ status: 400, description: 'Department has employees, sub-departments, or designations' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.departmentsService.remove(organizationId, id);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Restore soft-deleted department' })
  @ApiParam({ name: 'id', description: 'Department UUID' })
  @ApiResponse({ status: 200, description: 'Department restored', type: DepartmentResponseDto })
  @ApiResponse({ status: 404, description: 'Deleted department not found' })
  restore(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.departmentsService.restore(organizationId, id);
  }
}
