import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { paginate, PaginationDto } from '../../../common/dto/pagination.dto';
import { CreateTaxRuleDto, TaxCalculationType, UpdateTaxRuleDto } from './dto/create-tax-rule.dto';
import { TaxRuleQueryDto } from './dto/tax-rule-query.dto';

const COMMON_STATUTORY_TYPES = ['PF', 'ESI', 'PT', 'TDS'];

export const TAX_META = {
  calculationTypes: Object.values(TaxCalculationType),
  applicableOnOptions: ['GROSS', 'BASIC', 'NET', 'CUSTOM'],
  commonStatutoryTypes: COMMON_STATUTORY_TYPES,
  configSchemas: {
    PERCENTAGE: { fields: ['rate (0-100)', 'employeeSplit? (0-100)', 'employerSplit? (0-100)'] },
    FIXED: { fields: ['amount (> 0)'] },
    SLAB_BASED: { fields: ['slabs: [{fromAmount, toAmount?, rate?, fixedAmount?}]'] },
  },
};

@Injectable()
export class TaxRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateTaxRuleDto) {
    this.validateConfig(dto.calculationType, dto.config);

    if (dto.effectiveTo && new Date(dto.effectiveTo) <= new Date(dto.effectiveFrom)) {
      throw new BadRequestException('effectiveTo must be after effectiveFrom');
    }

    const overlapping = await this.prisma.taxRule.findFirst({
      where: { organizationId, type: dto.type, isActive: true, effectiveTo: null, deletedAt: null },
    });
    if (overlapping) {
      throw new ConflictException(
        `An active "${dto.type}" rule with no end date already exists ("${overlapping.name}"). Close it first or deactivate it before creating a new one.`,
      );
    }

    return this.prisma.taxRule.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code ?? null,
        type: dto.type,
        calculationType: dto.calculationType,
        applicableOn: dto.applicableOn,
        isStatutory: dto.isStatutory ?? false,
        config: dto.config as unknown as import('@prisma/client').Prisma.InputJsonValue,
        applicabilityRules: dto.applicabilityRules
          ? (dto.applicabilityRules as unknown as import('@prisma/client').Prisma.InputJsonValue)
          : undefined,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(organizationId: string, query: TaxRuleQueryDto) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(query.type && { type: query.type }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.isStatutory !== undefined && { isStatutory: query.isStatutory }),
    };

    const [data, total] = await Promise.all([
      this.prisma.taxRule.findMany({
        where,
        orderBy: [{ type: 'asc' }, { effectiveFrom: 'desc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.taxRule.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async findOne(organizationId: string, id: string) {
    const rule = await this.prisma.taxRule.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!rule) throw new NotFoundException('Tax rule not found');
    return rule;
  }

  async update(organizationId: string, id: string, dto: UpdateTaxRuleDto) {
    const rule = await this.prisma.taxRule.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!rule) throw new NotFoundException('Tax rule not found');

    const calcType = dto.calculationType ?? rule.calculationType;
    if (dto.config) this.validateConfig(calcType as TaxCalculationType, dto.config);

    if (dto.effectiveTo && new Date(dto.effectiveTo) <= new Date(rule.effectiveFrom)) {
      throw new BadRequestException('effectiveTo must be after effectiveFrom');
    }

    return this.prisma.taxRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.calculationType !== undefined && { calculationType: dto.calculationType }),
        ...(dto.applicableOn !== undefined && { applicableOn: dto.applicableOn }),
        ...(dto.isStatutory !== undefined && { isStatutory: dto.isStatutory }),
        ...(dto.config !== undefined && { config: dto.config as unknown as import('@prisma/client').Prisma.InputJsonValue }),
        ...(dto.applicabilityRules !== undefined && {
          applicabilityRules: dto.applicabilityRules as unknown as import('@prisma/client').Prisma.InputJsonValue,
        }),
        ...(dto.effectiveTo !== undefined && { effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async setActive(organizationId: string, id: string, isActive: boolean) {
    const rule = await this.prisma.taxRule.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!rule) throw new NotFoundException('Tax rule not found');
    return this.prisma.taxRule.update({ where: { id }, data: { isActive } });
  }

  async remove(organizationId: string, id: string) {
    const rule = await this.prisma.taxRule.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!rule) throw new NotFoundException('Tax rule not found');
    return this.prisma.taxRule.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(organizationId: string, id: string) {
    const rule = await this.prisma.taxRule.findFirst({ where: { id, organizationId, deletedAt: { not: null } } });
    if (!rule) throw new NotFoundException('Deleted tax rule not found');
    return this.prisma.taxRule.update({ where: { id }, data: { deletedAt: null } });
  }

  async findTrashed(organizationId: string, pagination: PaginationDto) {
    const where = { organizationId, deletedAt: { not: null } };
    const [data, total] = await Promise.all([
      this.prisma.taxRule.findMany({ where, orderBy: { deletedAt: 'desc' }, skip: pagination.skip, take: pagination.limit }),
      this.prisma.taxRule.count({ where }),
    ]);
    return paginate(data, total, pagination);
  }

  private validateConfig(type: TaxCalculationType, config: Record<string, unknown>) {
    if (type === TaxCalculationType.PERCENTAGE) {
      const rate = config['rate'];
      if (typeof rate !== 'number' || rate < 0 || rate > 100) {
        throw new BadRequestException('PERCENTAGE config requires "rate" between 0 and 100');
      }
      const empSplit = config['employeeSplit'];
      const errSplit = config['employerSplit'];
      if (empSplit !== undefined && (typeof empSplit !== 'number' || (empSplit as number) < 0 || (empSplit as number) > 100)) {
        throw new BadRequestException('employeeSplit must be 0-100');
      }
      if (errSplit !== undefined && (typeof errSplit !== 'number' || (errSplit as number) < 0 || (errSplit as number) > 100)) {
        throw new BadRequestException('employerSplit must be 0-100');
      }
    } else if (type === TaxCalculationType.FIXED) {
      const amount = config['amount'];
      if (typeof amount !== 'number' || amount <= 0) {
        throw new BadRequestException('FIXED config requires "amount" greater than 0');
      }
    } else if (type === TaxCalculationType.SLAB_BASED) {
      const slabs = config['slabs'];
      if (!Array.isArray(slabs) || slabs.length === 0) {
        throw new BadRequestException('SLAB_BASED config requires a non-empty "slabs" array');
      }
      for (const slab of slabs as Array<Record<string, unknown>>) {
        if (typeof slab['fromAmount'] !== 'number' || (slab['fromAmount'] as number) < 0) {
          throw new BadRequestException('Each slab must have a numeric "fromAmount" >= 0');
        }
        const hasRate = slab['rate'] !== undefined;
        const hasFixed = slab['fixedAmount'] !== undefined;
        if (!hasRate && !hasFixed) {
          throw new BadRequestException('Each slab must have either "rate" or "fixedAmount"');
        }
      }
    }
  }
}
