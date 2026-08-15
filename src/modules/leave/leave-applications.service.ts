import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { LeaveBalanceService } from './leave-balance.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { QueryLeaveDto } from './dto/query-leave.dto';
import { ApproveLeaveDto, RejectLeaveDto } from './dto/decide-leave.dto';

@Injectable()
export class LeaveApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaveBalanceService: LeaveBalanceService,
  ) {}

  async apply(organizationId: string, employeeId: string, dto: ApplyLeaveDto) {
    if (!employeeId) {
      throw new BadRequestException('No employee record found for the current user');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const policy = await this.prisma.leavePolicy.findFirst({
      where: { id: dto.leavePolicyId, organizationId, deletedAt: null },
    });
    if (!policy) throw new NotFoundException('Leave policy not found');

    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);
    const year = fromDate.getFullYear();

    // Policy-shape violations (maxConsecutiveDays) are checked BEFORE the
    // balance/overlap checks below: this is a structural rule of the policy
    // itself, independent of the employee's current balance or existing
    // applications, so it should fail fast with its own specific message
    // rather than being masked by "Insufficient leave balance" whenever an
    // employee also happens to have low/zero balance (the common case for a
    // freshly onboarded employee) — surfacing the wrong reason for the
    // rejection. See known-issues.md.
    if (policy.maxConsecutiveDays && dto.days > policy.maxConsecutiveDays) {
      throw new BadRequestException(
        `This leave policy allows a maximum of ${policy.maxConsecutiveDays} consecutive days`,
      );
    }

    const balance = await this.prisma.leaveBalance.findUnique({
      where: {
        employeeId_leavePolicyId_year: { employeeId, leavePolicyId: dto.leavePolicyId, year },
      },
    });
    if (!balance || balance.balanceDays < dto.days) {
      throw new BadRequestException('Insufficient leave balance for this request');
    }

    const overlapping = await this.prisma.leaveApplication.findFirst({
      where: {
        employeeId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        AND: [{ fromDate: { lte: toDate } }, { toDate: { gte: fromDate } }],
      },
    });
    if (overlapping) {
      throw new ConflictException(
        'An overlapping leave application already exists for these dates',
      );
    }

    return this.prisma.leaveApplication.create({
      data: {
        employeeId,
        leavePolicyId: dto.leavePolicyId,
        fromDate,
        toDate,
        days: dto.days,
        reason: dto.reason,
        status: LeaveStatus.PENDING,
      },
    });
  }

  async cancel(organizationId: string, employeeId: string, id: string) {
    const application = await this.prisma.leaveApplication.findFirst({
      where: { id, employee: { organizationId, deletedAt: null } },
    });
    if (!application) throw new NotFoundException('Leave application not found');
    if (application.employeeId !== employeeId) {
      throw new ForbiddenException('You can only cancel your own leave applications');
    }
    if (application.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leave applications can be cancelled');
    }

    return this.prisma.leaveApplication.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED, decidedAt: new Date() },
    });
  }

  async findAll(organizationId: string, query: QueryLeaveDto) {
    const where: Prisma.LeaveApplicationWhereInput = {
      employee: { organizationId, deletedAt: null },
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.status && { status: query.status }),
      ...this.buildDateFilters(query),
    };

    const [data, total] = await Promise.all([
      this.prisma.leaveApplication.findMany({
        where,
        include: {
          employee: { select: { id: true, empCode: true, firstName: true, lastName: true } },
          leavePolicy: { select: { id: true, name: true, leaveType: true } },
        },
        orderBy: { appliedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.leaveApplication.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async myApplications(organizationId: string, employeeId: string, query: QueryLeaveDto) {
    // Guard BEFORE building the Prisma `where`: a falsy `employeeId` (account
    // with no linked Employee row, e.g. the seeded super_admin) passed as
    // `employeeId: null` into a filter on a non-nullable String field throws
    // an uncaught PrismaClientValidationError -> raw 500 instead of a clean
    // 4xx, breaking the "no employee record" convention used elsewhere in the
    // codebase (loans, chat, notices, green-thanks, todos, performance,
    // attendance — see known-issues.md).
    if (!employeeId) {
      throw new BadRequestException('No employee record found for the current user');
    }
    const where: Prisma.LeaveApplicationWhereInput = {
      employeeId,
      employee: { organizationId, deletedAt: null },
      ...(query.status && { status: query.status }),
      ...this.buildDateFilters(query),
    };

    const [data, total] = await Promise.all([
      this.prisma.leaveApplication.findMany({
        where,
        include: {
          leavePolicy: { select: { id: true, name: true, leaveType: true } },
        },
        orderBy: { appliedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.leaveApplication.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async approve(organizationId: string, id: string, approverId: string, dto: ApproveLeaveDto) {
    const application = await this.prisma.leaveApplication.findFirst({
      where: { id, employee: { organizationId, deletedAt: null } },
    });
    if (!application) throw new NotFoundException('Leave application not found');
    if (application.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leave applications can be approved');
    }

    const year = application.fromDate.getFullYear();
    await this.leaveBalanceService.deductBalance(
      application.employeeId,
      application.leavePolicyId,
      year,
      application.days,
    );

    return this.prisma.leaveApplication.update({
      where: { id },
      data: {
        status: LeaveStatus.APPROVED,
        approverId,
        decidedAt: new Date(),
        rejectionNote: dto.notes ?? null,
      },
    });
  }

  async reject(organizationId: string, id: string, approverId: string, dto: RejectLeaveDto) {
    const application = await this.prisma.leaveApplication.findFirst({
      where: { id, employee: { organizationId, deletedAt: null } },
    });
    if (!application) throw new NotFoundException('Leave application not found');
    if (application.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leave applications can be rejected');
    }

    return this.prisma.leaveApplication.update({
      where: { id },
      data: {
        status: LeaveStatus.REJECTED,
        approverId,
        decidedAt: new Date(),
        rejectionNote: dto.rejectionNote,
      },
    });
  }

  private buildDateFilters(query: QueryLeaveDto): Prisma.LeaveApplicationWhereInput {
    if (query.fromDate || query.toDate) {
      return {
        ...(query.fromDate && { toDate: { gte: new Date(query.fromDate) } }),
        ...(query.toDate && { fromDate: { lte: new Date(query.toDate) } }),
      };
    }
    return {};
  }
}
