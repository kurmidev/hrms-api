import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { CreateIncentiveRuleDto } from './dto/create-incentive-rule.dto';
import { UpdateIncentiveRuleDto } from './dto/update-incentive-rule.dto';
import { QueryIncentiveRuleDto } from './dto/query-incentive-rule.dto';

@Injectable()
export class IncentiveRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateIncentiveRuleDto) {
    const rule = await this.prisma.incentiveRule.create({
      data: {
        organizationId,
        name: dto.name,
        type: dto.type,
        category: dto.category as Prisma.InputJsonValue,
        rate: dto.rate,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toResponse(rule);
  }

  async findAll(organizationId: string, query: QueryIncentiveRuleDto) {
    const where: Prisma.IncentiveRuleWhereInput = {
      organizationId,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.search && { name: { contains: query.search } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.incentiveRule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.incentiveRule.count({ where }),
    ]);

    return paginate(
      data.map((rule) => this.toResponse(rule)),
      total,
      query,
    );
  }

  async findOne(organizationId: string, id: string) {
    const rule = await this.getRuleOrThrow(organizationId, id);
    return this.toResponse(rule);
  }

  async update(organizationId: string, id: string, dto: UpdateIncentiveRuleDto) {
    await this.getRuleOrThrow(organizationId, id);

    const rule = await this.prisma.incentiveRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.category !== undefined && { category: dto.category as Prisma.InputJsonValue }),
        ...(dto.rate !== undefined && { rate: dto.rate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return this.toResponse(rule);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async getRuleOrThrow(organizationId: string, id: string) {
    const rule = await this.prisma.incentiveRule.findFirst({
      where: { id, organizationId },
    });
    if (!rule) throw new NotFoundException('Incentive rule not found');
    return rule;
  }

  private toResponse(rule: {
    id: string;
    organizationId: string;
    name: string;
    type: string;
    category: Prisma.JsonValue;
    rate: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: rule.id,
      organizationId: rule.organizationId,
      name: rule.name,
      type: rule.type,
      category: rule.category,
      rate: rule.rate,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
