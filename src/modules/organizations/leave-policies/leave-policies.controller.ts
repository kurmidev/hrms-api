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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { LeavePoliciesService, LEAVE_RULE_SCHEMA } from './leave-policies.service';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import { LeavePolicyQueryDto } from './dto/leave-policy-query.dto';
import { LeavePolicyResponseDto } from './dto/leave-policy-response.dto';
import { CreateLeaveRuleDto } from './dto/create-leave-rule.dto';
import { UpdateLeaveRuleDto } from './dto/update-leave-rule.dto';
import { LeaveRuleResponseDto } from './dto/leave-rule-response.dto';

@ApiTags('Leave Policies')
@ApiBearerAuth()
@Controller('leave-policies')
export class LeavePoliciesController {
  constructor(private readonly leavePoliciesService: LeavePoliciesService) {}

  @Get('rule-schema')
  @RequirePermissions('org:read')
  @ApiOperation({
    summary: 'Get leave rule schema',
    description: 'Returns available condition fields, operators, rule types, and action types for building leave policy rules.',
  })
  getRuleSchema() {
    return LEAVE_RULE_SCHEMA;
  }

  @Get('trash')
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'List soft-deleted leave policies' })
  findTrashed(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.leavePoliciesService.findTrashed(organizationId, pagination);
  }

  @Post()
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Create leave policy', description: 'Creates a new leave policy with entitlement, accrual, and eligibility settings.' })
  @ApiResponse({ status: 201, description: 'Leave policy created', type: LeavePolicyResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateLeavePolicyDto,
  ) {
    return this.leavePoliciesService.create(organizationId, dto);
  }

  @Get()
  @RequirePermissions('org:read')
  @ApiOperation({ summary: 'List leave policies', description: 'Paginated list. Filter by ?leaveType=CASUAL or ?isActive=true.' })
  @ApiResponse({ status: 200, description: 'Leave policies list', type: [LeavePolicyResponseDto] })
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: LeavePolicyQueryDto,
  ) {
    return this.leavePoliciesService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('org:read')
  @ApiOperation({ summary: 'Get leave policy by ID', description: 'Returns the policy with all active rules embedded.' })
  @ApiParam({ name: 'id', description: 'Leave policy UUID' })
  @ApiResponse({ status: 200, description: 'Leave policy details', type: LeavePolicyResponseDto })
  @ApiResponse({ status: 404, description: 'Leave policy not found' })
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.leavePoliciesService.findOne(organizationId, id);
  }

  @Put(':id')
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Update leave policy' })
  @ApiParam({ name: 'id', description: 'Leave policy UUID' })
  @ApiResponse({ status: 200, description: 'Leave policy updated', type: LeavePolicyResponseDto })
  @ApiResponse({ status: 404, description: 'Leave policy not found' })
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeavePolicyDto,
  ) {
    return this.leavePoliciesService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Soft-delete leave policy', description: 'Soft-deletes the policy. Fails if employees are assigned to it.' })
  @ApiParam({ name: 'id', description: 'Leave policy UUID' })
  @ApiResponse({ status: 200, description: 'Leave policy soft-deleted' })
  @ApiResponse({ status: 400, description: 'Policy has assigned employees' })
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.leavePoliciesService.remove(organizationId, id);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Restore soft-deleted leave policy' })
  @ApiParam({ name: 'id', description: 'Leave policy UUID' })
  restore(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.leavePoliciesService.restore(organizationId, id);
  }

  // ----------- Rules sub-resource -----------

  @Get(':policyId/rules/trash')
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'List soft-deleted rules for a policy' })
  @ApiParam({ name: 'policyId', description: 'Leave policy UUID' })
  findTrashedRules(
    @CurrentUser('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.leavePoliciesService.findTrashedRules(organizationId, policyId, pagination);
  }

  @Post(':policyId/rules')
  @RequirePermissions('org:update')
  @ApiOperation({
    summary: 'Create leave policy rule',
    description: 'Adds a conditional rule to the policy. Call GET /leave-policies/rule-schema first to understand available fields, operators, and actions.',
  })
  @ApiParam({ name: 'policyId', description: 'Leave policy UUID' })
  @ApiResponse({ status: 201, description: 'Rule created', type: LeaveRuleResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid ruleType/action combination or unsupported condition field' })
  createRule(
    @CurrentUser('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
    @Body() dto: CreateLeaveRuleDto,
  ) {
    return this.leavePoliciesService.createRule(organizationId, policyId, dto);
  }

  @Get(':policyId/rules')
  @RequirePermissions('org:read')
  @ApiOperation({ summary: 'List rules for a leave policy', description: 'Returns rules ordered by priority (ascending). Active rules only.' })
  @ApiParam({ name: 'policyId', description: 'Leave policy UUID' })
  @ApiResponse({ status: 200, description: 'Policy rules', type: [LeaveRuleResponseDto] })
  findRules(
    @CurrentUser('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
  ) {
    return this.leavePoliciesService.findRules(organizationId, policyId);
  }

  @Patch(':policyId/rules/reorder')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Reorder rules by priority', description: 'Pass an ordered array of rule IDs. First ID gets priority 0, second gets priority 1, etc.' })
  @ApiParam({ name: 'policyId', description: 'Leave policy UUID' })
  @ApiBody({ schema: { type: 'object', properties: { ruleIds: { type: 'array', items: { type: 'string' } } } } })
  reorderRules(
    @CurrentUser('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
    @Body('ruleIds') ruleIds: string[],
  ) {
    return this.leavePoliciesService.reorderRules(organizationId, policyId, ruleIds);
  }

  @Get(':policyId/rules/:ruleId')
  @RequirePermissions('org:read')
  @ApiOperation({ summary: 'Get a specific rule' })
  @ApiParam({ name: 'policyId', description: 'Leave policy UUID' })
  @ApiParam({ name: 'ruleId', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Rule details', type: LeaveRuleResponseDto })
  findRule(
    @CurrentUser('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
    @Param('ruleId') ruleId: string,
  ) {
    return this.leavePoliciesService.findRule(organizationId, policyId, ruleId);
  }

  @Put(':policyId/rules/:ruleId')
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Update a rule' })
  @ApiParam({ name: 'policyId', description: 'Leave policy UUID' })
  @ApiParam({ name: 'ruleId', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Rule updated', type: LeaveRuleResponseDto })
  updateRule(
    @CurrentUser('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateLeaveRuleDto,
  ) {
    return this.leavePoliciesService.updateRule(organizationId, policyId, ruleId, dto);
  }

  @Delete(':policyId/rules/:ruleId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Soft-delete a rule' })
  @ApiParam({ name: 'policyId', description: 'Leave policy UUID' })
  @ApiParam({ name: 'ruleId', description: 'Rule UUID' })
  removeRule(
    @CurrentUser('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
    @Param('ruleId') ruleId: string,
  ) {
    return this.leavePoliciesService.removeRule(organizationId, policyId, ruleId);
  }

  @Patch(':policyId/rules/:ruleId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Restore soft-deleted rule' })
  @ApiParam({ name: 'policyId', description: 'Leave policy UUID' })
  @ApiParam({ name: 'ruleId', description: 'Rule UUID' })
  restoreRule(
    @CurrentUser('organizationId') organizationId: string,
    @Param('policyId') policyId: string,
    @Param('ruleId') ruleId: string,
  ) {
    return this.leavePoliciesService.restoreRule(organizationId, policyId, ruleId);
  }
}
