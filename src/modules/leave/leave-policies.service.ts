import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import { QueryLeavePolicyDto } from './dto/query-leave-policy.dto';

@Injectable()
export class LeavePoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: QueryLeavePolicyDto) {
    const where: Prisma.LeavePolicyWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.leaveType && { leaveType: query.leaveType }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [data, total] = await Promise.all([
      this.prisma.leavePolicy.findMany({
        where,
        orderBy: [{ leaveType: 'asc' }, { name: 'asc' }],
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
    });
    if (!policy) throw new NotFoundException('Leave policy not found');
    return policy;
  }

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
    });
  }

  async update(organizationId: string, id: string, dto: UpdateLeavePolicyDto) {
    await this.findOne(organizationId, id);

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
    });
  }

  async toggle(organizationId: string, id: string) {
    const policy = await this.findOne(organizationId, id);
    return this.prisma.leavePolicy.update({
      where: { id },
      data: { isActive: !policy.isActive },
    });
  }
}
