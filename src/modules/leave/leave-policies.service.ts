import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import { QueryLeavePolicyDto } from './dto/query-leave-policy.dto';
import { LeavePolicyTypeItemDto } from './dto/leave-policy-type-item.dto';

const TYPES_INCLUDE = { types: true } as const;

@Injectable()
export class LeavePoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: QueryLeavePolicyDto) {
    const where: Prisma.LeavePolicyWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.leaveType && { types: { some: { leaveType: query.leaveType } } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.leavePolicy.findMany({
        where,
        include: TYPES_INCLUDE,
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.leavePolicy.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async findOne(organizationId: string, id: string) {
    const policy = await this.prisma.leavePolicy.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: TYPES_INCLUDE,
    });
    if (!policy) throw new NotFoundException('Leave policy not found');
    return policy;
  }

  async create(organizationId: string, dto: CreateLeavePolicyDto) {
    this.assertNoDuplicateTypes(dto.types);

    return this.prisma.leavePolicy.create({
      data: {
        organizationId,
        name: dto.name,
        isActive: dto.isActive ?? true,
        types: {
          create: dto.types.map((t) => this.toTypeCreateData(t)),
        },
      },
      include: TYPES_INCLUDE,
    });
  }

  async update(organizationId: string, id: string, dto: UpdateLeavePolicyDto) {
    const policy = await this.prisma.leavePolicy.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: TYPES_INCLUDE,
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

    return this.findOne(organizationId, id);
  }

  async toggle(organizationId: string, id: string) {
    const policy = await this.findOne(organizationId, id);
    await this.prisma.leavePolicy.update({
      where: { id },
      data: { isActive: !policy.isActive },
    });
    return this.findOne(organizationId, id);
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
}
