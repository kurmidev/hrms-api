import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';

@Injectable()
export class SubscriptionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(all = false) {
    return this.prisma.subscriptionPlan.findMany({
      where: all ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        maxEmployees: dto.maxEmployees,
        priceMonthly: dto.priceMonthly,
        priceQuarterly: dto.priceQuarterly,
        priceYearly: dto.priceYearly,
        features: dto.features ?? [],
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: Partial<CreatePlanDto>) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.maxEmployees !== undefined && { maxEmployees: dto.maxEmployees }),
        ...(dto.priceMonthly !== undefined && { priceMonthly: dto.priceMonthly }),
        ...(dto.priceQuarterly !== undefined && { priceQuarterly: dto.priceQuarterly }),
        ...(dto.priceYearly !== undefined && { priceYearly: dto.priceYearly }),
        ...(dto.features !== undefined && { features: dto.features }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deactivate(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
