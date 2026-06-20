import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { PayrollStructuresService } from './payroll-structures.service';
import { CreatePayrollStructureDto } from './dto/create-payroll-structure.dto';
import { UpdatePayrollStructureDto } from './dto/update-payroll-structure.dto';
import { PayrollStructureResponseDto } from './dto/payroll-structure-response.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('payroll-structures')
export class PayrollStructuresController {
  constructor(private readonly payrollStructuresService: PayrollStructuresService) {}

  @Get('trash')
  @RequirePermissions('payroll:read')
  @ApiOperation({ summary: 'List soft-deleted payroll structures' })
  @ApiResponse({ status: 200, description: 'Trashed payroll structures' })
  findTrashed(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.payrollStructuresService.findTrashed(organizationId, pagination);
  }

  @Post()
  @RequirePermissions('payroll:create')
  @ApiOperation({ summary: 'Create payroll structure', description: 'Creates a named salary structure with earning and deduction components.' })
  @ApiResponse({ status: 201, description: 'Payroll structure created', type: PayrollStructureResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error — duplicate component names, no earning component, or invalid values' })
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreatePayrollStructureDto,
  ) {
    return this.payrollStructuresService.create(organizationId, dto);
  }

  @Get()
  @RequirePermissions('payroll:read')
  @ApiOperation({ summary: 'List payroll structures', description: 'Paginated list with employee and designation counts.' })
  @ApiResponse({ status: 200, description: 'Payroll structures list' })
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.payrollStructuresService.findAll(organizationId, pagination);
  }

  @Get(':id')
  @RequirePermissions('payroll:read')
  @ApiOperation({ summary: 'Get payroll structure by ID', description: 'Returns full structure with components and linked designations.' })
  @ApiParam({ name: 'id', description: 'Payroll structure UUID' })
  @ApiResponse({ status: 200, description: 'Payroll structure details', type: PayrollStructureResponseDto })
  @ApiResponse({ status: 404, description: 'Payroll structure not found' })
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.payrollStructuresService.findOne(organizationId, id);
  }

  @Put(':id')
  @RequirePermissions('payroll:update')
  @ApiOperation({ summary: 'Update payroll structure', description: 'Updates name, components, or active status.' })
  @ApiParam({ name: 'id', description: 'Payroll structure UUID' })
  @ApiResponse({ status: 200, description: 'Payroll structure updated', type: PayrollStructureResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error in component list' })
  @ApiResponse({ status: 404, description: 'Payroll structure not found' })
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePayrollStructureDto,
  ) {
    return this.payrollStructuresService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll:delete')
  @ApiOperation({ summary: 'Soft-delete payroll structure', description: 'Soft-deletes. Fails if employees are currently assigned.' })
  @ApiParam({ name: 'id', description: 'Payroll structure UUID' })
  @ApiResponse({ status: 200, description: 'Payroll structure soft-deleted' })
  @ApiResponse({ status: 400, description: 'Structure has assigned employees' })
  @ApiResponse({ status: 404, description: 'Payroll structure not found' })
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.payrollStructuresService.remove(organizationId, id);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll:update')
  @ApiOperation({ summary: 'Restore soft-deleted payroll structure' })
  @ApiParam({ name: 'id', description: 'Payroll structure UUID' })
  @ApiResponse({ status: 200, description: 'Payroll structure restored', type: PayrollStructureResponseDto })
  @ApiResponse({ status: 404, description: 'Deleted payroll structure not found' })
  restore(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.payrollStructuresService.restore(organizationId, id);
  }

  @Post(':id/designations')
  @RequirePermissions('payroll:update')
  @ApiOperation({ summary: 'Assign designation to payroll structure', description: 'Links a designation to this payroll structure. One designation can only be linked to one structure at a time.' })
  @ApiParam({ name: 'id', description: 'Payroll structure UUID' })
  @ApiResponse({ status: 201, description: 'Designation assigned' })
  @ApiResponse({ status: 404, description: 'Payroll structure or designation not found' })
  assignDesignation(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') structureId: string,
    @Body('designationId') designationId: string,
  ) {
    return this.payrollStructuresService.assignDesignation(organizationId, structureId, designationId);
  }

  @Get(':id/designations')
  @RequirePermissions('payroll:read')
  @ApiOperation({ summary: 'Get designations linked to this payroll structure' })
  @ApiParam({ name: 'id', description: 'Payroll structure UUID' })
  @ApiResponse({ status: 200, description: 'Linked designations' })
  @ApiResponse({ status: 404, description: 'Payroll structure not found' })
  findDesignations(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') structureId: string,
  ) {
    return this.payrollStructuresService.findDesignations(organizationId, structureId);
  }

  @Delete(':id/designations/:designationId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll:update')
  @ApiOperation({ summary: 'Remove designation from payroll structure' })
  @ApiParam({ name: 'id', description: 'Payroll structure UUID' })
  @ApiParam({ name: 'designationId', description: 'Designation UUID' })
  @ApiResponse({ status: 200, description: 'Designation unlinked' })
  @ApiResponse({ status: 404, description: 'Link not found' })
  unassignDesignation(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') structureId: string,
    @Param('designationId') designationId: string,
  ) {
    return this.payrollStructuresService.unassignDesignation(organizationId, structureId, designationId);
  }
}
