import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateGreenThanksConfigDto } from './dto/update-green-thanks-config.dto';

const DEFAULT_INR_PER_POINT = 50;
const DEFAULT_QUARTERLY_LIMIT_POINTS = 100;

@Injectable()
export class GreenThanksConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert-on-read singleton per organization. Returns the existing config
   * row, creating one with schema defaults on first access.
   */
  async get(organizationId: string) {
    const existing = await this.prisma.greenThanksConfig.findFirst({
      where: { organizationId },
    });
    if (existing) return this.toResponse(existing);

    const created = await this.prisma.greenThanksConfig.create({
      data: {
        organizationId,
        inrPerPoint: DEFAULT_INR_PER_POINT,
        quarterlyLimitPoints: DEFAULT_QUARTERLY_LIMIT_POINTS,
        isPayrollLinked: true,
        effectiveFrom: new Date(),
      },
    });
    return this.toResponse(created);
  }

  async update(organizationId: string, dto: UpdateGreenThanksConfigDto) {
    const existing = await this.prisma.greenThanksConfig.findFirst({
      where: { organizationId },
    });

    const data = {
      ...(dto.inrPerPoint !== undefined && { inrPerPoint: dto.inrPerPoint }),
      ...(dto.quarterlyLimitPoints !== undefined && {
        quarterlyLimitPoints: dto.quarterlyLimitPoints,
      }),
      ...(dto.isPayrollLinked !== undefined && { isPayrollLinked: dto.isPayrollLinked }),
      ...(dto.effectiveFrom !== undefined && { effectiveFrom: new Date(dto.effectiveFrom) }),
    };

    const updated = existing
      ? await this.prisma.greenThanksConfig.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.greenThanksConfig.create({
          data: {
            organizationId,
            inrPerPoint: dto.inrPerPoint ?? DEFAULT_INR_PER_POINT,
            quarterlyLimitPoints: dto.quarterlyLimitPoints ?? DEFAULT_QUARTERLY_LIMIT_POINTS,
            isPayrollLinked: dto.isPayrollLinked ?? true,
            effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
          },
        });

    return this.toResponse(updated);
  }

  private toResponse(config: {
    id: string;
    organizationId: string;
    inrPerPoint: number;
    quarterlyLimitPoints: number;
    isPayrollLinked: boolean;
    effectiveFrom: Date;
    createdAt: Date;
  }) {
    return {
      id: config.id,
      organizationId: config.organizationId,
      inrPerPoint: config.inrPerPoint,
      quarterlyLimitPoints: config.quarterlyLimitPoints,
      isPayrollLinked: config.isPayrollLinked,
      effectiveFrom: config.effectiveFrom,
      createdAt: config.createdAt,
    };
  }
}
