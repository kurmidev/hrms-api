import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PerformanceCycleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { CreatePerformanceCycleDto } from './dto/create-performance-cycle.dto';
import { QueryPerformanceCycleDto } from './dto/query-performance-cycle.dto';
import { SubmitRatingDto } from './dto/submit-rating.dto';
import { QueryRatingDto } from './dto/query-rating.dto';
import { QueryKpiDto } from './dto/query-kpi.dto';

export interface RequestingUser {
  employeeId: string | null;
  permissions: string[];
}

const RATING_WITH_RELATIONS = {
  employee: {
    select: { id: true, empCode: true, firstName: true, lastName: true },
  },
  cycle: {
    select: { id: true, name: true, status: true },
  },
} satisfies Prisma.PerformanceRatingInclude;

type RatingWithRelations = Prisma.PerformanceRatingGetPayload<{
  include: typeof RATING_WITH_RELATIONS;
}>;

const MAX_REPORTING_HOPS = 20;

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Cycles ─────────────────────────────────────────────────────────────────

  async createCycle(organizationId: string, dto: CreatePerformanceCycleDto) {
    const existing = await this.prisma.performanceCycle.findFirst({
      where: { organizationId, name: dto.name },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `A performance cycle named "${dto.name}" already exists in this organization`,
      );
    }

    const created = await this.prisma.performanceCycle.create({
      data: {
        organizationId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: dto.status ?? PerformanceCycleStatus.DRAFT,
      },
    });

    return this.toCycleResponse(created);
  }

  async findAllCycles(organizationId: string, query: QueryPerformanceCycleDto) {
    const where: Prisma.PerformanceCycleWhereInput = {
      organizationId,
      ...(query.status && { status: query.status }),
      ...(query.search && { name: { contains: query.search } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.performanceCycle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.performanceCycle.count({ where }),
    ]);

    return paginate(
      data.map((cycle) => this.toCycleResponse(cycle)),
      total,
      query,
    );
  }

  async findOneCycle(organizationId: string, id: string) {
    const cycle = await this.getCycleOrThrow(organizationId, id);
    return this.toCycleResponse(cycle);
  }

  async activateCycle(organizationId: string, id: string) {
    const cycle = await this.getCycleOrThrow(organizationId, id);
    if (cycle.status !== PerformanceCycleStatus.DRAFT) {
      throw new BadRequestException(
        `Only a DRAFT cycle can be activated (current status: ${cycle.status})`,
      );
    }

    const updated = await this.prisma.performanceCycle.update({
      where: { id },
      data: { status: PerformanceCycleStatus.ACTIVE },
    });

    return this.toCycleResponse(updated);
  }

  async closeCycle(organizationId: string, id: string) {
    const cycle = await this.getCycleOrThrow(organizationId, id);
    if (cycle.status !== PerformanceCycleStatus.ACTIVE) {
      throw new BadRequestException(
        `Only an ACTIVE cycle can be closed (current status: ${cycle.status})`,
      );
    }

    const updated = await this.prisma.performanceCycle.update({
      where: { id },
      data: { status: PerformanceCycleStatus.CLOSED, closedAt: new Date() },
    });

    return this.toCycleResponse(updated);
  }

  // ─── Ratings ────────────────────────────────────────────────────────────────

  async submitRating(
    organizationId: string,
    cycleId: string,
    currentUser: RequestingUser,
    dto: SubmitRatingDto,
  ) {
    const cycle = await this.getCycleOrThrow(organizationId, cycleId);
    if (cycle.status !== PerformanceCycleStatus.ACTIVE) {
      throw new BadRequestException(
        cycle.status === PerformanceCycleStatus.DRAFT
          ? 'This performance cycle has not started yet (still DRAFT) — ratings cannot be submitted'
          : 'This performance cycle is CLOSED — ratings are locked and cannot be edited',
      );
    }

    const raterEmployeeId = currentUser.employeeId;
    if (!raterEmployeeId) {
      throw new ForbiddenException('No employee record found for the current user');
    }

    const ratee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
      select: { id: true, reportingManagerId: true },
    });
    if (!ratee) throw new NotFoundException('Employee not found');

    await this.assertRaterInReportingChain(organizationId, ratee, raterEmployeeId);

    const saved = await this.prisma.performanceRating.upsert({
      where: { cycleId_employeeId: { cycleId, employeeId: dto.employeeId } },
      create: {
        cycleId,
        employeeId: dto.employeeId,
        ratedBy: raterEmployeeId,
        rating: dto.rating,
        comments: dto.comments,
        isEligibleForIncrement: dto.isEligibleForIncrement ?? false,
      },
      update: {
        ratedBy: raterEmployeeId,
        rating: dto.rating,
        comments: dto.comments,
        isEligibleForIncrement: dto.isEligibleForIncrement ?? false,
      },
      include: RATING_WITH_RELATIONS,
    });

    const raterMap = await this.getRaterMap(organizationId, [saved]);
    return this.toRatingResponse(saved, raterMap);
  }

  async findRatings(organizationId: string, cycleId: string, query: QueryRatingDto) {
    await this.getCycleOrThrow(organizationId, cycleId);

    const where: Prisma.PerformanceRatingWhereInput = {
      cycleId,
      ...(query.employeeId && { employeeId: query.employeeId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.performanceRating.findMany({
        where,
        include: RATING_WITH_RELATIONS,
        orderBy: { submittedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.performanceRating.count({ where }),
    ]);

    const raterMap = await this.getRaterMap(organizationId, data);

    return paginate(
      data.map((rating) => this.toRatingResponse(rating, raterMap)),
      total,
      query,
    );
  }

  async findMyRatings(organizationId: string, currentUser: RequestingUser, query: QueryRatingDto) {
    const employeeId = currentUser.employeeId;
    if (!employeeId) {
      return paginate([], 0, query);
    }

    const where: Prisma.PerformanceRatingWhereInput = {
      employeeId,
      cycle: { organizationId },
    };

    const [data, total] = await Promise.all([
      this.prisma.performanceRating.findMany({
        where,
        include: RATING_WITH_RELATIONS,
        orderBy: { submittedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.performanceRating.count({ where }),
    ]);

    const raterMap = await this.getRaterMap(organizationId, data);

    return paginate(
      data.map((rating) => this.toRatingResponse(rating, raterMap)),
      total,
      query,
    );
  }

  // ─── KPIs ───────────────────────────────────────────────────────────────────

  async listKpis(organizationId: string, query: QueryKpiDto) {
    const where: Prisma.EmployeeKpiWhereInput = {
      kpi: {
        organizationId,
        ...(query.designationId && { designationId: query.designationId }),
      },
      ...(query.status && { status: query.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.employeeKpi.findMany({
        where,
        include: {
          kpi: {
            include: { designation: { select: { id: true, name: true } } },
          },
          employee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { assignedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.employeeKpi.count({ where }),
    ]);

    return paginate(
      data.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
        designationId: row.kpi.designationId,
        designationName: row.kpi.designation.name,
        kpiTitle: row.kpi.title,
        targetValue: row.kpi.targetValue,
        unit: row.kpi.unit,
        achievedValue: row.achievedValue,
        status: row.status,
      })),
      total,
      query,
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async getCycleOrThrow(organizationId: string, id: string) {
    const cycle = await this.prisma.performanceCycle.findFirst({
      where: { id, organizationId },
    });
    if (!cycle) throw new NotFoundException('Performance cycle not found');
    return cycle;
  }

  /**
   * Walks the ratee's reportingManagerId chain (bounded, cycle-guarded, mirrors
   * employees.service.ts#getReportingChain) and asserts the rater's employeeId
   * appears in it. Guards against undefined ids before any Prisma where (rule §12).
   */
  private async assertRaterInReportingChain(
    organizationId: string,
    ratee: { id: string; reportingManagerId: string | null },
    raterEmployeeId: string,
  ): Promise<void> {
    if (!organizationId || !raterEmployeeId || !ratee?.id) {
      throw new ForbiddenException('You can only rate your reporting-chain subordinates');
    }

    if (ratee.id === raterEmployeeId) {
      throw new ForbiddenException('You cannot rate yourself');
    }

    const visited = new Set<string>([ratee.id]);
    let currentManagerId = ratee.reportingManagerId;
    let hops = 0;

    while (currentManagerId && hops < MAX_REPORTING_HOPS) {
      if (currentManagerId === raterEmployeeId) return;
      if (visited.has(currentManagerId)) break; // cycle guard
      visited.add(currentManagerId);
      hops += 1;

      const manager = await this.prisma.employee.findFirst({
        where: { id: currentManagerId, organizationId, deletedAt: null },
        select: { id: true, reportingManagerId: true },
      });
      if (!manager) break;
      currentManagerId = manager.reportingManagerId;
    }

    throw new ForbiddenException('You can only rate your reporting-chain subordinates');
  }

  /**
   * `ratedBy` is a plain employeeId column (no Prisma relation defined for it),
   * so rater display names are resolved via a single batched lookup rather
   * than a Prisma `include`.
   */
  private async getRaterMap(
    organizationId: string,
    ratings: { ratedBy: string }[],
  ): Promise<Map<string, { id: string; empCode: string; firstName: string; lastName: string }>> {
    const raterIds = [...new Set(ratings.map((r) => r.ratedBy).filter(Boolean))];
    if (raterIds.length === 0) return new Map();

    const raters = await this.prisma.employee.findMany({
      where: { id: { in: raterIds }, organizationId },
      select: { id: true, empCode: true, firstName: true, lastName: true },
    });

    return new Map(raters.map((rater) => [rater.id, rater]));
  }

  private toCycleResponse(cycle: {
    id: string;
    organizationId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    status: PerformanceCycleStatus;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: cycle.id,
      name: cycle.name,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      status: cycle.status,
      closedAt: cycle.closedAt,
      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt,
    };
  }

  private toRatingResponse(
    rating: RatingWithRelations,
    raterMap?: Map<string, { id: string; empCode: string; firstName: string; lastName: string }>,
  ) {
    const rater = raterMap?.get(rating.ratedBy) ?? null;

    return {
      id: rating.id,
      cycleId: rating.cycleId,
      employeeId: rating.employeeId,
      ratedBy: rating.ratedBy,
      rating: rating.rating,
      comments: rating.comments,
      isEligibleForIncrement: rating.isEligibleForIncrement,
      submittedAt: rating.submittedAt,
      updatedAt: rating.updatedAt,
      employee: rating.employee
        ? {
            id: rating.employee.id,
            empCode: rating.employee.empCode,
            firstName: rating.employee.firstName,
            lastName: rating.employee.lastName,
          }
        : null,
      rater,
      cycle: rating.cycle
        ? { id: rating.cycle.id, name: rating.cycle.name, status: rating.cycle.status }
        : null,
    };
  }
}
