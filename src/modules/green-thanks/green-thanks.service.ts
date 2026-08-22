import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { CreateGreenThanksDto } from './dto/create-green-thanks.dto';
import { ApproveGreenThanksDto } from './dto/approve-green-thanks.dto';
import { QueryGreenThanksDto } from './dto/query-green-thanks.dto';

export const GREEN_THANKS_APPROVE_PERMISSION = 'leave:approve';

export interface RequestingUser {
  employeeId: string | null;
  permissions: string[];
}

export interface ApprovedGreenThanksForPeriod {
  totalAmount: number;
  greenThanksIds: string[];
}

const DEFAULT_INR_PER_POINT = 50;

const GREEN_THANKS_WITH_RELATIONS = {
  fromEmployee: {
    select: { id: true, empCode: true, firstName: true, lastName: true },
  },
  toEmployee: {
    select: { id: true, empCode: true, firstName: true, lastName: true },
  },
} satisfies Prisma.GreenThanksInclude;

type GreenThanksWithRelations = Prisma.GreenThanksGetPayload<{
  include: typeof GREEN_THANKS_WITH_RELATIONS;
}>;

@Injectable()
export class GreenThanksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Broad "privileged viewer" check used to scope findAll() to all org rows. */
  private canSeeAllRows(currentUser: RequestingUser): boolean {
    return (
      currentUser.permissions.includes(GREEN_THANKS_APPROVE_PERMISSION) ||
      currentUser.permissions.includes('employee:read') ||
      currentUser.permissions.includes('*')
    );
  }

  /** Strict check for the approve/reject action itself — leave:approve only. */
  private canApprove(currentUser: RequestingUser): boolean {
    return (
      currentUser.permissions.includes(GREEN_THANKS_APPROVE_PERMISSION) ||
      currentUser.permissions.includes('*')
    );
  }

  /**
   * Lightweight org-employee list for the "send Green Thanks" recipient
   * picker. Deliberately NOT gated by `employee:read` — every seeded role
   * that can send Green Thanks (`green_thanks:create`, incl. plain
   * `employee`) does not necessarily hold `employee:read`, so reusing
   * `EmployeesService.findAll` here would silently 403 the picker for the
   * exact users the feature targets. Excludes the caller (can't send to self,
   * enforced separately in `create()` too).
   */
  async listRecipients(organizationId: string, currentUser: RequestingUser) {
    const fromEmployeeId = currentUser.employeeId;
    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(fromEmployeeId && { id: { not: fromEmployeeId } }),
      },
      select: { id: true, empCode: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return employees;
  }

  async create(organizationId: string, currentUser: RequestingUser, dto: CreateGreenThanksDto) {
    const fromEmployeeId = currentUser.employeeId;
    if (!fromEmployeeId) {
      throw new BadRequestException('No employee record found for the current user');
    }

    if (dto.toEmployeeId === fromEmployeeId) {
      throw new BadRequestException('You cannot send Green Thanks to yourself');
    }

    const toEmployee = await this.prisma.employee.findFirst({
      where: { id: dto.toEmployeeId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!toEmployee) throw new NotFoundException('Recipient employee not found');

    const config = await this.getOrgConfig(organizationId);
    const { start, end } = this.getCurrentQuarterRange();

    const existingAgg = await this.prisma.greenThanks.aggregate({
      where: {
        fromEmployeeId,
        status: { not: 'rejected' },
        createdAt: { gte: start, lte: end },
      },
      _sum: { points: true },
    });
    const existingPoints = existingAgg._sum.points ?? 0;

    if (existingPoints + dto.points > config.quarterlyLimitPoints) {
      throw new BadRequestException(
        `Sending ${dto.points} points would exceed your quarterly Green Thanks limit of ` +
          `${config.quarterlyLimitPoints} points (already used ${existingPoints} this quarter)`,
      );
    }

    const created = await this.prisma.greenThanks.create({
      data: {
        fromEmployeeId,
        toEmployeeId: dto.toEmployeeId,
        points: dto.points,
        reason: dto.reason,
        status: 'pending',
      },
      include: GREEN_THANKS_WITH_RELATIONS,
    });

    return this.toResponse(created);
  }

  async findAll(organizationId: string, currentUser: RequestingUser, query: QueryGreenThanksDto) {
    const canSeeAll = this.canSeeAllRows(currentUser);
    const scopedEmployeeId = canSeeAll ? query.employeeId : currentUser.employeeId;

    if (!canSeeAll && !scopedEmployeeId) {
      return paginate([], 0, query);
    }

    const directionFilter: Prisma.GreenThanksWhereInput | undefined = scopedEmployeeId
      ? query.direction === 'sent'
        ? { fromEmployeeId: scopedEmployeeId }
        : query.direction === 'received'
          ? { toEmployeeId: scopedEmployeeId }
          : { OR: [{ fromEmployeeId: scopedEmployeeId }, { toEmployeeId: scopedEmployeeId }] }
      : undefined;

    const where: Prisma.GreenThanksWhereInput = {
      fromEmployee: { organizationId },
      ...(directionFilter ?? {}),
      ...(query.status && { status: query.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.greenThanks.findMany({
        where,
        include: GREEN_THANKS_WITH_RELATIONS,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.greenThanks.count({ where }),
    ]);

    return paginate(
      data.map((entry) => this.toResponse(entry)),
      total,
      query,
    );
  }

  async approve(
    organizationId: string,
    userId: string,
    currentUser: RequestingUser,
    id: string,
    dto: ApproveGreenThanksDto,
  ) {
    if (!this.canApprove(currentUser)) {
      throw new ForbiddenException('You are not permitted to approve or reject Green Thanks');
    }

    const entry = await this.getEntryOrThrow(organizationId, id);
    if (
      currentUser.employeeId &&
      (entry.fromEmployeeId === currentUser.employeeId ||
        entry.toEmployeeId === currentUser.employeeId)
    ) {
      throw new ForbiddenException(
        'You cannot approve or reject a Green Thanks entry you sent or received',
      );
    }
    if (entry.status !== 'pending') {
      throw new BadRequestException(
        'Only a pending Green Thanks entry can be approved or rejected',
      );
    }

    if (!dto.approve) {
      // NOTE: GreenThanks has no rejectionNote column in schema.prisma (unlike
      // TodoTask/IncentiveLedger's approve flows). The dto field is accepted
      // for API-shape parity with the plan/frontend but is not persisted
      // separately here — it is folded into `reason` so it is not silently
      // dropped, without requiring a schema migration.
      const rejected = await this.prisma.greenThanks.update({
        where: { id },
        data: {
          status: 'rejected',
          approvedBy: userId,
          ...(dto.rejectionNote && {
            reason: `${entry.reason}\n[Rejected: ${dto.rejectionNote}]`,
          }),
        },
        include: GREEN_THANKS_WITH_RELATIONS,
      });
      return this.toResponse(rejected);
    }

    const now = new Date();
    const payrollMonth = dto.payrollMonth ?? now.getMonth() + 1;
    const payrollYear = dto.payrollYear ?? now.getFullYear();

    const approved = await this.prisma.greenThanks.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: userId,
        awardedAt: now,
        payrollMonth,
        payrollYear,
      },
      include: GREEN_THANKS_WITH_RELATIONS,
    });

    return this.toResponse(approved);
  }

  /**
   * Consumed by PayrollService.processRun. Returns the INR sum of approved,
   * not-yet-paid GreenThanks points for (employeeId, month, year), plus the
   * row ids to mark as paid after the payroll entry is persisted. Idempotent:
   * a repeat call for an already-paid period returns
   * { totalAmount: 0, greenThanksIds: [] } because isPaid rows are excluded.
   */
  async getApprovedGreenThanksForPeriod(
    organizationId: string,
    employeeId: string,
    month: number,
    year: number,
  ): Promise<ApprovedGreenThanksForPeriod> {
    const config = await this.getOrgConfig(organizationId);

    const rows = await this.prisma.greenThanks.findMany({
      where: {
        toEmployeeId: employeeId,
        status: 'approved',
        isPaid: false,
        payrollMonth: month,
        payrollYear: year,
        toEmployee: { organizationId },
      },
      select: { id: true, points: true },
    });

    if (rows.length === 0) {
      return { totalAmount: 0, greenThanksIds: [] };
    }

    const totalPoints = rows.reduce((sum, row) => sum + row.points, 0);

    return {
      totalAmount: totalPoints * config.inrPerPoint,
      greenThanksIds: rows.map((row) => row.id),
    };
  }

  /**
   * Consumed by PayrollService after persisting a PayrollEntry. Flips
   * isPaid on the given GreenThanks rows. No-op on empty array. Idempotent —
   * safe to call repeatedly with the same ids.
   */
  async markGreenThanksPaid(ids: string[], payrollEntryId?: string): Promise<void> {
    if (ids.length === 0) return;
    // NOTE: GreenThanks has no payrollEntryId column in schema.prisma (unlike
    // IncentiveLedger). The parameter is kept for call-site/signature parity
    // with markIncentiveDeducted/markEmiDeducted; it is intentionally unused here.
    void payrollEntryId;

    await this.prisma.greenThanks.updateMany({
      where: { id: { in: ids } },
      data: { isPaid: true },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async getOrgConfig(
    organizationId: string,
  ): Promise<{ inrPerPoint: number; quarterlyLimitPoints: number }> {
    const config = await this.prisma.greenThanksConfig.findFirst({
      where: { organizationId },
      select: { inrPerPoint: true, quarterlyLimitPoints: true },
    });
    return (
      config ?? {
        inrPerPoint: DEFAULT_INR_PER_POINT,
        quarterlyLimitPoints: 100,
      }
    );
  }

  private getCurrentQuarterRange(): { start: Date; end: Date } {
    const now = new Date();
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), quarterStartMonth, 1);
    const end = new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private async getEntryOrThrow(
    organizationId: string,
    id: string,
  ): Promise<GreenThanksWithRelations> {
    const entry = await this.prisma.greenThanks.findFirst({
      where: { id, fromEmployee: { organizationId } },
      include: GREEN_THANKS_WITH_RELATIONS,
    });
    if (!entry) throw new NotFoundException('Green Thanks entry not found');
    return entry;
  }

  private toResponse(entry: GreenThanksWithRelations) {
    return {
      id: entry.id,
      fromEmployeeId: entry.fromEmployeeId,
      fromEmployee: entry.fromEmployee
        ? {
            id: entry.fromEmployee.id,
            empCode: entry.fromEmployee.empCode,
            firstName: entry.fromEmployee.firstName,
            lastName: entry.fromEmployee.lastName,
          }
        : null,
      toEmployeeId: entry.toEmployeeId,
      toEmployee: entry.toEmployee
        ? {
            id: entry.toEmployee.id,
            empCode: entry.toEmployee.empCode,
            firstName: entry.toEmployee.firstName,
            lastName: entry.toEmployee.lastName,
          }
        : null,
      points: entry.points,
      reason: entry.reason,
      status: entry.status,
      approvedBy: entry.approvedBy,
      awardedAt: entry.awardedAt,
      payrollMonth: entry.payrollMonth,
      payrollYear: entry.payrollYear,
      isPaid: entry.isPaid,
      createdAt: entry.createdAt,
    };
  }
}
