import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TAX_META, TaxRulesService } from './tax-rules.service';
import { CreateTaxRuleDto, UpdateTaxRuleDto } from './dto/create-tax-rule.dto';
import { TaxRuleQueryDto } from './dto/tax-rule-query.dto';
import { TaxRuleResponseDto } from './dto/tax-rule-response.dto';

class SetActiveDto {
  @IsBoolean()
  isActive: boolean;
}

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('tax-rules')
export class TaxRulesController {
  constructor(private readonly taxRulesService: TaxRulesService) {}

  @Get('meta')
  @RequirePermissions('payroll:read')
  @ApiOperation({
    summary: 'Get tax rule metadata',
    description: 'Returns available calculation types, applicable-on options, and common statutory type identifiers.',
  })
  @ApiResponse({ status: 200, description: 'Tax rule metadata' })
  getMeta() {
    return TAX_META;
  }

  @Get('trash')
  @RequirePermissions('payroll:read')
  @ApiOperation({ summary: 'List soft-deleted tax rules' })
  @ApiResponse({ status: 200, description: 'Trashed tax rules' })
  findTrashed(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.taxRulesService.findTrashed(organizationId, pagination);
  }

  @Post()
  @RequirePermissions('payroll:create')
  @ApiOperation({
    summary: 'Create tax rule',
    description: 'Creates a generic tax rule. Supports PERCENTAGE, FIXED, and SLAB_BASED calculation types. Tax rules are append-only — deactivate old rules instead of editing them.',
  })
  @ApiResponse({ status: 201, description: 'Tax rule created', type: TaxRuleResponseDto })
  @ApiResponse({ status: 409, description: 'Active rule of the same type with no end date already exists' })
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateTaxRuleDto,
  ) {
    return this.taxRulesService.create(organizationId, dto);
  }

  @Get()
  @RequirePermissions('payroll:read')
  @ApiOperation({ summary: 'List tax rules', description: 'Paginated. Filter by ?type=PF, ?isActive=true, ?isStatutory=true.' })
  @ApiResponse({ status: 200, description: 'Tax rules list' })
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: TaxRuleQueryDto,
  ) {
    return this.taxRulesService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('payroll:read')
  @ApiOperation({ summary: 'Get tax rule by ID' })
  @ApiParam({ name: 'id', description: 'Tax rule UUID' })
  @ApiResponse({ status: 200, description: 'Tax rule details', type: TaxRuleResponseDto })
  @ApiResponse({ status: 404, description: 'Tax rule not found' })
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.taxRulesService.findOne(organizationId, id);
  }

  @Put(':id')
  @RequirePermissions('payroll:create')
  @ApiOperation({ summary: 'Update tax rule' })
  @ApiParam({ name: 'id', description: 'Tax rule UUID' })
  @ApiResponse({ status: 200, description: 'Tax rule updated', type: TaxRuleResponseDto })
  @ApiResponse({ status: 404, description: 'Tax rule not found' })
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaxRuleDto,
  ) {
    return this.taxRulesService.update(organizationId, id, dto);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll:create')
  @ApiOperation({ summary: 'Activate/deactivate tax rule' })
  @ApiParam({ name: 'id', description: 'Tax rule UUID' })
  @ApiBody({ schema: { example: { isActive: false } } })
  @ApiResponse({ status: 200, description: 'Status updated', type: TaxRuleResponseDto })
  setActive(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: SetActiveDto,
  ) {
    return this.taxRulesService.setActive(organizationId, id, body.isActive);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll:create')
  @ApiOperation({ summary: 'Soft-delete tax rule' })
  @ApiParam({ name: 'id', description: 'Tax rule UUID' })
  @ApiResponse({ status: 200, description: 'Tax rule soft-deleted' })
  @ApiResponse({ status: 404, description: 'Tax rule not found' })
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.taxRulesService.remove(organizationId, id);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll:create')
  @ApiOperation({ summary: 'Restore soft-deleted tax rule' })
  @ApiParam({ name: 'id', description: 'Tax rule UUID' })
  @ApiResponse({ status: 200, description: 'Tax rule restored' })
  @ApiResponse({ status: 404, description: 'Deleted tax rule not found' })
  restore(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.taxRulesService.restore(organizationId, id);
  }
}
