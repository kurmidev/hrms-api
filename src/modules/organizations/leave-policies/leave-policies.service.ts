import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { paginate, PaginationDto } from '../../../common/dto/pagination.dto';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import { LeavePolicyQueryDto } from './dto/leave-policy-query.dto';
import { LeavePolicyTypeItemDto } from './dto/leave-policy-type-item.dto';
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

  private readonly policyInclude = {
    types: true,
    _count: { select: { employees: true, rules: true } },
  } as const;

  async create(organizationId: string, dto: CreateLeavePolicyDto) {
    this.assertNoDuplicateTypes(dto.types);

    return this.prisma.leavePolicy.create({
      data: {
        organizationId,
        name: dto.name,
        isActive: dto.isActive ?? true,
        types: { create: dto.types.map((t) => this.toTypeCreateData(t)) },
      },
      include: this.policyInclude,
    });
  }

  async findAll(organizationId: string, query: LeavePolicyQueryDto) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(query.leaveType !== undefined && { types: { some: { leaveType: query.leaveType } } }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [data, total] = await Promise.all([
      this.prisma.leavePolicy.findMany({
        where,
        include: this.policyInclude,
        orderBy: { name: 'asc' },
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
        ...this.policyInclude,
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
    const policy = await this.prisma.leavePolicy.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { types: true },
    });
    if (!policy) throw new NotFoundException('Leave policy not found');

    if (dto.types) {
      this.assertNoDuplicateTypes(dto.types);
      await this.reconcileTypes(policy.id, policy.types, dto.types);
    }

    await this.prisma.leavePolicy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    const updated = await this.prisma.leavePolicy.findFirst({
      where: { id },
      include: this.policyInclude,
    });
    return this.toResponse(updated!);
  }

  private assertNoDuplicateTypes(types: LeavePolicyTypeItemDto[]) {
    const seen = new Set<string>();
    for (const t of types) {
      if (seen.has(t.leaveType)) {
        throw new BadRequestException(
          `Duplicate leave type "${t.leaveType}" in policy — each type may appear once per bundle`,
        );
      }
      seen.add(t.leaveType);
    }
  }

  private toTypeCreateData(t: LeavePolicyTypeItemDto) {
    return {
      leaveType: t.leaveType,
      name: t.name ?? null,
      daysPerYear: t.daysPerYear,
      carryForwardMax: t.carryForwardMax ?? 0,
      accrualType: t.accrualType ?? 'monthly',
      isEncashable: t.isEncashable ?? false,
      isLopEligible: t.isLopEligible ?? true,
      minAdvanceDays: t.minAdvanceDays ?? 0,
      maxConsecutiveDays: t.maxConsecutiveDays ?? null,
      allowedInProbation: t.allowedInProbation ?? false,
      genderRestriction: t.genderRestriction ?? null,
    };
  }

  /**
   * Reconciles an existing bundle's LeavePolicyType rows against the
   * incoming `types` payload from an update request:
   *  - items matched by `id` (or by `leaveType` when `id` is omitted) are
   *    updated in place
   *  - items with no match are created
   *  - existing types absent from the payload are deleted, UNLESS a
   *    LeaveBalance or LeaveApplication already references them — in that
   *    case the specific type's removal is blocked with a clear error,
   *    consistent with DepartmentsService.remove()'s pre-delete related-
   *    record check.
   */
  private async reconcileTypes(
    policyId: string,
    existing: Array<{ id: string; leaveType: string }>,
    items: LeavePolicyTypeItemDto[],
  ) {
    const existingById = new Map(existing.map((t) => [t.id, t]));
    const existingByType = new Map(existing.map((t) => [t.leaveType, t]));
    const keepIds = new Set<string>();

    for (const item of items) {
      const match =
        (item.id && existingById.get(item.id)) || existingByType.get(item.leaveType) || null;
      const data = this.toTypeCreateData(item);

      if (match) {
        await this.prisma.leavePolicyType.update({ where: { id: match.id }, data });
        keepIds.add(match.id);
      } else {
        const created = await this.prisma.leavePolicyType.create({
          data: { leavePolicyId: policyId, ...data },
        });
        keepIds.add(created.id);
      }
    }

    const toRemove = existing.filter((t) => !keepIds.has(t.id));
    for (const type of toRemove) {
      const [balanceCount, applicationCount] = await Promise.all([
        this.prisma.leaveBalance.count({ where: { leavePolicyTypeId: type.id } }),
        this.prisma.leaveApplication.count({ where: { leavePolicyTypeId: type.id } }),
      ]);
      if (balanceCount > 0 || applicationCount > 0) {
        throw new BadRequestException(
          `Cannot remove leave type "${type.leaveType}" from this policy — ` +
            `${balanceCount} balance record(s) and ${applicationCount} application(s) reference it`,
        );
      }
      await this.prisma.leavePolicyType.delete({ where: { id: type.id } });
    }
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
    const policy = await this.prisma.leavePolicy.findFirst({
      where: { id, organizationId, deletedAt: { not: null } },
    });
    if (!policy) throw new NotFoundException('Deleted leave policy not found');
    return this.prisma.leavePolicy.update({ where: { id }, data: { deletedAt: null } });
  }

  async findTrashed(organizationId: string, pagination: PaginationDto) {
    const where = { organizationId, deletedAt: { not: null } };
    const [data, total] = await Promise.all([
      this.prisma.leavePolicy.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
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

  async updateRule(
    organizationId: string,
    policyId: string,
    ruleId: string,
    dto: UpdateLeaveRuleDto,
  ) {
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

    await this.prisma.leavePolicyRule.update({
      where: { id: ruleId },
      data: { deletedAt: new Date() },
    });
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
      this.prisma.leavePolicyRule.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
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
    const policy = await this.prisma.leavePolicy.findFirst({
      where: { id: policyId, organizationId, deletedAt: null },
    });
    if (!policy) throw new NotFoundException('Leave policy not found');
    return policy;
  }

  private validateRule(dto: CreateLeaveRuleDto) {
    const allowedActions = RULE_TYPE_ACTION_MAP[dto.ruleType as RuleType];
    if (!allowedActions) {
      throw new BadRequestException(
        `Invalid ruleType: ${dto.ruleType}. Allowed: ${RULE_TYPES.join(', ')}`,
      );
    }

    const action = dto.action as { type: string };
    if (!allowedActions.includes(action.type)) {
      throw new BadRequestException(
        `Action type "${action.type}" is not valid for ruleType "${dto.ruleType}". Allowed: ${allowedActions.join(', ')}`,
      );
    }

    for (const condition of dto.conditions as LeaveRuleConditionDto[]) {
      if (
        !ALLOWED_CONDITION_FIELDS.includes(
          condition.field as (typeof ALLOWED_CONDITION_FIELDS)[number],
        )
      ) {
        throw new BadRequestException(
          `Invalid condition field: "${condition.field}". Allowed: ${ALLOWED_CONDITION_FIELDS.join(', ')}`,
        );
      }
      if (
        !CONDITION_OPERATORS.includes(condition.operator as (typeof CONDITION_OPERATORS)[number])
      ) {
        throw new BadRequestException(
          `Invalid operator: "${condition.operator}". Allowed: ${CONDITION_OPERATORS.join(', ')}`,
        );
      }

      if (condition.field === 'employmentType' && !['IN', 'NOT_IN'].includes(condition.operator)) {
        throw new BadRequestException(
          `Condition field "employmentType" only supports IN / NOT_IN operators`,
        );
      }
    }
  }

  private toResponse(p: {
    id: string;
    organizationId: string;
    name: string;
    isActive: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    types: Array<{
      id: string;
      leavePolicyId: string;
      leaveType: string;
      name: string | null;
      daysPerYear: number;
      carryForwardMax: number;
      accrualType: string;
      isEncashable: boolean;
      isLopEligible: boolean;
      minAdvanceDays: number;
      maxConsecutiveDays: number | null;
      allowedInProbation: boolean;
      genderRestriction: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    _count: { employees: number; rules: number };
  }) {
    return {
      id: p.id,
      organizationId: p.organizationId,
      name: p.name,
      isActive: p.isActive,
      employeeCount: p._count.employees,
      ruleCount: p._count.rules,
      types: p.types,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    };
  }
}
