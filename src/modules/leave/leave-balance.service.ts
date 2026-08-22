import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { QueryLeaveBalanceDto } from './dto/query-leave-balance.dto';

@Injectable()
export class LeaveBalanceService {
  private readonly logger = new Logger(LeaveBalanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // `client` optionally accepts an interactive `Prisma.TransactionClient` (from a
  // caller's `prisma.$transaction(async (tx) => ...)`) so this write participates
  // in that transaction instead of committing independently on the default
  // singleton connection. Defaults to `this.prisma` for every existing caller.
  async initializeForEmployee(
    employeeId: string,
    leavePolicyTypeId: string,
    year: number = new Date().getFullYear(),
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const type = await client.leavePolicyType.findFirst({
      where: { id: leavePolicyTypeId, leavePolicy: { deletedAt: null } },
    });
    if (!type) throw new NotFoundException('Leave policy type not found');

    return client.leaveBalance.upsert({
      where: { employeeId_leavePolicyTypeId_year: { employeeId, leavePolicyTypeId, year } },
      create: {
        employeeId,
        leavePolicyTypeId,
        year,
        entitledDays: type.daysPerYear,
        takenDays: 0,
        carriedForwardDays: 0,
        balanceDays: type.daysPerYear,
      },
      update: {},
    });
  }

  /**
   * No code path creates a LeaveBalance row when an employee is onboarded or
   * a leave policy is created — `initializeForEmployee` above was dead code.
   * Employees never had a balance to display or draw against. Called
   * lazily from `getMyBalance` (and `apply`) so it also backfills employees
   * who were already migrated/onboarded before this existed.
   *
   * Balances are per LeavePolicyType now (not per LeavePolicy bundle), so
   * this loops over every active type inside every active bundle in the
   * organization rather than over LeavePolicy rows directly.
   */
  async ensureBalancesForEmployee(
    organizationId: string,
    employeeId: string,
    year: number = new Date().getFullYear(),
  ) {
    const types = await this.prisma.leavePolicyType.findMany({
      where: { leavePolicy: { organizationId, deletedAt: null, isActive: true } },
    });
    for (const type of types) {
      await this.initializeForEmployee(employeeId, type.id, year);
    }
  }

  async getBalances(organizationId: string, query: QueryLeaveBalanceDto) {
    const where: Prisma.LeaveBalanceWhereInput = {
      employee: { organizationId, deletedAt: null },
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.year && { year: query.year }),
    };

    const [data, total] = await Promise.all([
      this.prisma.leaveBalance.findMany({
        where,
        include: {
          employee: { select: { id: true, empCode: true, firstName: true, lastName: true } },
          leavePolicyType: {
            select: { id: true, name: true, leaveType: true, leavePolicyId: true },
          },
        },
        orderBy: { year: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.leaveBalance.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async getMyBalance(
    organizationId: string,
    employeeId: string,
    year: number = new Date().getFullYear(),
  ) {
    // Guard BEFORE the Prisma call: a falsy `employeeId` (account with no
    // linked Employee row, e.g. the seeded super_admin) passed as `id: null`
    // throws an uncaught PrismaClientValidationError -> raw 500 instead of a
    // clean 4xx, breaking the "no employee record" convention used elsewhere
    // in the codebase (loans, chat, notices, green-thanks, todos, performance,
    // attendance — see known-issues.md).
    if (!employeeId) {
      throw new BadRequestException('No employee record found for the current user');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    await this.ensureBalancesForEmployee(organizationId, employeeId, year);

    return this.prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: {
        leavePolicyType: {
          select: { id: true, name: true, leaveType: true, isEncashable: true },
        },
      },
      orderBy: { leavePolicyType: { leaveType: 'asc' } },
    });
  }

  /**
   * `force` bypasses the sufficiency check and lets balanceDays go negative —
   * used by discretionary special-leave grants (ServiceRequestsService), which
   * are approved on top of an employee's normal entitlement and must not be
   * blocked by it. Defaults to false so every existing caller is unaffected.
   */
  async deductBalance(
    employeeId: string,
    leavePolicyTypeId: string,
    year: number,
    days: number,
    force = false,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const balance = await client.leaveBalance.findUnique({
      where: { employeeId_leavePolicyTypeId_year: { employeeId, leavePolicyTypeId, year } },
    });
    if (!balance) throw new NotFoundException('Leave balance not found for this policy/year');
    if (!force && balance.balanceDays < days) {
      throw new BadRequestException('Insufficient leave balance');
    }

    return client.leaveBalance.update({
      where: { id: balance.id },
      data: {
        takenDays: balance.takenDays + days,
        balanceDays: balance.balanceDays - days,
      },
    });
  }

  async restoreBalance(employeeId: string, leavePolicyTypeId: string, year: number, days: number) {
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leavePolicyTypeId_year: { employeeId, leavePolicyTypeId, year } },
    });
    if (!balance) return null;

    return this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        takenDays: Math.max(0, balance.takenDays - days),
        balanceDays: balance.balanceDays + days,
      },
    });
  }

  /**
   * Monthly accrual job — runs at 00:05 on the 1st of every month.
   * Adds 1/12th of daysPerYear to every active employee's leave balance
   * for policy types with accrualType === 'monthly'.
   */
  @Cron('5 0 1 * *')
  async accrueMonthly() {
    const year = new Date().getFullYear();
    const types = await this.prisma.leavePolicyType.findMany({
      where: {
        accrualType: 'monthly',
        leavePolicy: { deletedAt: null, isActive: true },
      },
      include: {
        leavePolicy: {
          include: {
            employees: { where: { deletedAt: null, status: 'ACTIVE' }, select: { id: true } },
          },
        },
      },
    });

    for (const type of types) {
      const monthlyAccrual = type.daysPerYear / 12;
      for (const employee of type.leavePolicy.employees) {
        const balance = await this.prisma.leaveBalance.upsert({
          where: {
            employeeId_leavePolicyTypeId_year: {
              employeeId: employee.id,
              leavePolicyTypeId: type.id,
              year,
            },
          },
          create: {
            employeeId: employee.id,
            leavePolicyTypeId: type.id,
            year,
            entitledDays: monthlyAccrual,
            takenDays: 0,
            carriedForwardDays: 0,
            balanceDays: monthlyAccrual,
          },
          update: {
            entitledDays: { increment: monthlyAccrual },
            balanceDays: { increment: monthlyAccrual },
          },
        });
        this.logger.debug(
          `Accrued ${monthlyAccrual} days for employee ${employee.id} policy type ${type.id} (balance ${balance.balanceDays})`,
        );
      }
    }
  }
}
