import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { paginate, PaginationDto } from '../../../common/dto/pagination.dto';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import { LeavePolicyQueryDto } from './dto/leave-policy-query.dto';
import {
  ALLOWED_CONDITION_FIELDS,
  CONDITION_OPERATORS,
  CreateLeaveRuleDto,
  LeaveRuleConditionDto,
  RULE_TYPES,
  RuleType,
} from './dto/create-leave-rule.dto';
import { UpdateLeaveRuleDto } from './dto/update-leave-rule.dto';

const RULE_TYPE_ACTION_MAP: Record<RuleType, string[]> = {
  ELIGIBILITY: ['ALLOW', 'DENY'],
  ENTITLEMENT: ['SET_DAYS', 'ADD_DAYS'],
  APPLICATION: ['SET_MIN_ADVANCE', 'SET_MAX_CONSECUTIVE', 'SET_MAX_PER_YEAR'],
  APPROVAL: ['AUTO_APPROVE', 'MANAGER', 'HR', 'MULTI_LEVEL'],
  CARRY_FORWARD: ['SET_MAX_DAYS', 'SET_EXPIRY_MONTHS', 'ENCASH_REMAINDER'],
};

export const LEAVE_RULE_SCHEMA = {
  conditionFields: ALLOWED_CONDITION_FIELDS,
  operators: CONDITION_OPERATORS,
  ruleTypes: RULE_TYPES,
  ruleTypeActionMap: RULE_TYPE_ACTION_MAP,
  conditionFieldTypes: {
    employmentType: { operatorsAllowed: ['IN', 'NOT_IN'], valueType: 'string[]' },
    yearsOfService: { operatorsAllowed: ['EQ', 'GTE', 'LTE', 'GT', 'LT'], valueType: 'number' },
    designationLevel: { operatorsAllowed: ['EQ', 'GTE', 'LTE', 'GT', 'LT'], valueType: 'number' },
    gender: { operatorsAllowed: ['EQ', 'NEQ'], valueType: 'MALE | FEMALE' },
    daysRequested: { operatorsAllowed: ['EQ', 'GTE', 'LTE', 'GT', 'LT'], valueType: 'number' },
  },
};

@Injectable()
export class LeavePoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateLeavePolicyDto) {
    return this.prisma.leavePolicy.create({
      data: {
        organizationId,
        name: dto.name,
        leaveType: dto.leaveType,
        daysPerYear: dto.daysPerYear,
        carryForwardMax: dto.carryForwardMax ?? 0,
        accrualType: dto.accrualType ?? 'monthly',
        isEncashable: dto.isEncashable ?? false,
        isLopEligible: dto.isLopEligible ?? true,
        minAdvanceDays: dto.minAdvanceDays ?? 0,
        maxConsecutiveDays: dto.maxConsecutiveDays ?? null,
        allowedInProbation: dto.allowedInProbation ?? false,
        genderRestriction: dto.genderRestriction ?? null,
        isActive: dto.isActive ?? true,
      },
      include: {
        _count: { select: { employees: true, rules: true } },
      },
    });
  }

  async findAll(organizationId: string, query: LeavePolicyQueryDto) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(query.leaveType !== undefined && { leaveType: query.leaveType }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [data, total] = await Promise.all([
      this.prisma.leavePolicy.findMany({
        where,
        include: { _count: { select: { employees: true, rules: true } } },
        orderBy: [{ leaveType: 'asc' }, { name: 'asc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.leavePolicy.count({ where }),
    ]);

    return paginate(
      data.map((p) => this.toResponse(p)),
      total,
      query,
    );
  }

  async findOne(organizationId: string, id: string) {
    const policy = await this.prisma.leavePolicy.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        _count: { select: { employees: true, rules: true } },
        rules: {
          where: { deletedAt: null },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, name: true, ruleType: true, priority: true, isActive: true },
        },
      },
    });
    if (!policy) throw new NotFoundException('Leave policy not found');

    return {
      ...this.toResponse(policy),
      rules: policy.rules,
    };
  }

  async update(organizationId: string, id: string, dto: UpdateLeavePolicyDto) {
    const policy = await this.prisma.leavePolicy.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!policy) throw new NotFoundException('Leave policy not found');

    return this.prisma.leavePolicy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.leaveType !== undefined && { leaveType: dto.leaveType }),
        ...(dto.daysPerYear !== undefined && { daysPerYear: dto.daysPerYear }),
        ...(dto.carryForwardMax !== undefined && { carryForwardMax: dto.carryForwardMax }),
        ...(dto.accrualType !== undefined && { accrualType: dto.accrualType }),
        ...(dto.isEncashable !== undefined && { isEncashable: dto.isEncashable }),
        ...(dto.isLopEligible !== undefined && { isLopEligible: dto.isLopEligible }),
        ...(dto.minAdvanceDays !== undefined && { minAdvanceDays: dto.minAdvanceDays }),
        ...(dto.maxConsecutiveDays !== undefined && { maxConsecutiveDays: dto.maxConsecutiveDays }),
        ...(dto.allowedInProbation !== undefined && { allowedInProbation: dto.allowedInProbation }),
        ...(dto.genderRestriction !== undefined && { genderRestriction: dto.genderRestriction }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { _count: { select: { employees: true, rules: true } } },
    });
  }

  async remove(organizationId: string, id: string) {
    const policy = await this.prisma.leavePolicy.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { _count: { select: { employees: true } } },
    });
    if (!policy) throw new NotFoundException('Leave policy not found');

    if (policy._count.employees > 0) {
      throw new BadRequestException(
        `Cannot delete leave policy — ${policy._count.employees} employee(s) are assigned to it.`,
      );
    }

    await this.prisma.leavePolicy.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true, message: `Leave policy "${policy.name}" deleted successfully` };
  }

  async restore(organizationId: string, id: string) {
    const policy = await this.prisma.leavePolicy.findFirst({ where: { id, organizationId, deletedAt: { not: null } } });
    if (!policy) throw new NotFoundException('Deleted leave policy not found');
    return this.prisma.leavePolicy.update({ where: { id }, data: { deletedAt: null } });
  }

  async findTrashed(organizationId: string, pagination: PaginationDto) {
    const where = { organizationId, deletedAt: { not: null } };
    const [data, total] = await Promise.all([
      this.prisma.leavePolicy.findMany({ where, orderBy: { deletedAt: 'desc' }, skip: pagination.skip, take: pagination.limit }),
      this.prisma.leavePolicy.count({ where }),
    ]);
    return paginate(data, total, pagination);
  }

  async createRule(organizationId: string, policyId: string, dto: CreateLeaveRuleDto) {
    await this.verifyPolicy(organizationId, policyId);
    this.validateRule(dto);

    return this.prisma.leavePolicyRule.create({
      data: {
        organizationId,
        leavePolicyId: policyId,
        name: dto.name,
        ruleType: dto.ruleType,
        conditionLogic: dto.conditionLogic,
        conditions: dto.conditions as unknown as object,
        action: dto.action as unknown as object,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findRules(organizationId: string, policyId: string) {
    await this.verifyPolicy(organizationId, policyId);
    return this.prisma.leavePolicyRule.findMany({
      where: { leavePolicyId: policyId, organizationId, deletedAt: null },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findRule(organizationId: string, policyId: string, ruleId: string) {
    const rule = await this.prisma.leavePolicyRule.findFirst({
      where: { id: ruleId, leavePolicyId: policyId, organizationId, deletedAt: null },
    });
    if (!rule) throw new NotFoundException('Leave policy rule not found');
    return rule;
  }

  async updateRule(organizationId: string, policyId: string, ruleId: string, dto: UpdateLeaveRuleDto) {
    await this.verifyPolicy(organizationId, policyId);
    const rule = await this.prisma.leavePolicyRule.findFirst({
      where: { id: ruleId, leavePolicyId: policyId, organizationId, deletedAt: null },
    });
    if (!rule) throw new NotFoundException('Leave policy rule not found');

    if (dto.ruleType || dto.action) {
      const merged = { ...rule, ...dto } as CreateLeaveRuleDto;
      this.validateRule(merged);
    }

    return this.prisma.leavePolicyRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.ruleType !== undefined && { ruleType: dto.ruleType }),
        ...(dto.conditionLogic !== undefined && { conditionLogic: dto.conditionLogic }),
        ...(dto.conditions !== undefined && { conditions: dto.conditions as unknown as object }),
        ...(dto.action !== undefined && { action: dto.action as unknown as object }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async removeRule(organizationId: string, policyId: string, ruleId: string) {
    await this.verifyPolicy(organizationId, policyId);
    const rule = await this.prisma.leavePolicyRule.findFirst({
      where: { id: ruleId, leavePolicyId: policyId, organizationId, deletedAt: null },
    });
    if (!rule) throw new NotFoundException('Leave policy rule not found');

    await this.prisma.leavePolicyRule.update({ where: { id: ruleId }, data: { deletedAt: new Date() } });
    return { deleted: true, message: `Rule "${rule.name}" deleted successfully` };
  }

  async restoreRule(organizationId: string, policyId: string, ruleId: string) {
    const rule = await this.prisma.leavePolicyRule.findFirst({
      where: { id: ruleId, leavePolicyId: policyId, organizationId, deletedAt: { not: null } },
    });
    if (!rule) throw new NotFoundException('Deleted rule not found');
    return this.prisma.leavePolicyRule.update({ where: { id: ruleId }, data: { deletedAt: null } });
  }

  async findTrashedRules(organizationId: string, policyId: string, pagination: PaginationDto) {
    await this.verifyPolicy(organizationId, policyId);
    const where = { leavePolicyId: policyId, organizationId, deletedAt: { not: null } };
    const [data, total] = await Promise.all([
      this.prisma.leavePolicyRule.findMany({ where, orderBy: { deletedAt: 'desc' }, skip: pagination.skip, take: pagination.limit }),
      this.prisma.leavePolicyRule.count({ where }),
    ]);
    return paginate(data, total, pagination);
  }

  async reorderRules(organizationId: string, policyId: string, orderedIds: string[]) {
    await this.verifyPolicy(organizationId, policyId);

    await Promise.all(
      orderedIds.map((ruleId, index) =>
        this.prisma.leavePolicyRule.updateMany({
          where: { id: ruleId, leavePolicyId: policyId, organizationId },
          data: { priority: index },
        }),
      ),
    );

    return this.findRules(organizationId, policyId);
  }

  private async verifyPolicy(organizationId: string, policyId: string) {
    const policy = await this.prisma.leavePolicy.findFirst({ where: { id: policyId, organizationId, deletedAt: null } });
    if (!policy) throw new NotFoundException('Leave policy not found');
    return policy;
  }

  private validateRule(dto: CreateLeaveRuleDto) {
    const allowedActions = RULE_TYPE_ACTION_MAP[dto.ruleType as RuleType];
    if (!allowedActions) {
      throw new BadRequestException(`Invalid ruleType: ${dto.ruleType}. Allowed: ${RULE_TYPES.join(', ')}`);
    }

    const action = dto.action as { type: string };
    if (!allowedActions.includes(action.type)) {
      throw new BadRequestException(
        `Action type "${action.type}" is not valid for ruleType "${dto.ruleType}". Allowed: ${allowedActions.join(', ')}`,
      );
    }

    for (const condition of dto.conditions as LeaveRuleConditionDto[]) {
      if (!ALLOWED_CONDITION_FIELDS.includes(condition.field as (typeof ALLOWED_CONDITION_FIELDS)[number])) {
        throw new BadRequestException(`Invalid condition field: "${condition.field}". Allowed: ${ALLOWED_CONDITION_FIELDS.join(', ')}`);
      }
      if (!CONDITION_OPERATORS.includes(condition.operator as (typeof CONDITION_OPERATORS)[number])) {
        throw new BadRequestException(`Invalid operator: "${condition.operator}". Allowed: ${CONDITION_OPERATORS.join(', ')}`);
      }

      if ((condition.field === 'employmentType') && !['IN', 'NOT_IN'].includes(condition.operator)) {
        throw new BadRequestException(`Condition field "employmentType" only supports IN / NOT_IN operators`);
      }
    }
  }

  private toResponse(p: {
    id: string;
    organizationId: string;
    name: string;
    leaveType: string;
    daysPerYear: number;
    carryForwardMax: number;
    accrualType: string;
    isEncashable: boolean;
    isLopEligible: boolean;
    minAdvanceDays: number;
    maxConsecutiveDays: number | null;
    allowedInProbation: boolean;
    genderRestriction: string | null;
    isActive: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { employees: number; rules: number };
  }) {
    return {
      id: p.id,
      organizationId: p.organizationId,
      name: p.name,
      leaveType: p.leaveType,
      daysPerYear: p.daysPerYear,
      carryForwardMax: p.carryForwardMax,
      accrualType: p.accrualType,
      isEncashable: p.isEncashable,
      isLopEligible: p.isLopEligible,
      minAdvanceDays: p.minAdvanceDays,
      maxConsecutiveDays: p.maxConsecutiveDays,
      allowedInProbation: p.allowedInProbation,
      genderRestriction: p.genderRestriction,
      isActive: p.isActive,
      employeeCount: p._count.employees,
      ruleCount: p._count.rules,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    };
  }
}
