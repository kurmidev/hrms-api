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

  async initializeForEmployee(
    employeeId: string,
    leavePolicyId: string,
    year: number = new Date().getFullYear(),
  ) {
    const policy = await this.prisma.leavePolicy.findFirst({
      where: { id: leavePolicyId, deletedAt: null },
    });
    if (!policy) throw new NotFoundException('Leave policy not found');

    return this.prisma.leaveBalance.upsert({
      where: { employeeId_leavePolicyId_year: { employeeId, leavePolicyId, year } },
      create: {
        employeeId,
        leavePolicyId,
        year,
        entitledDays: policy.daysPerYear,
        takenDays: 0,
        carriedForwardDays: 0,
        balanceDays: policy.daysPerYear,
      },
      update: {},
    });
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
          leavePolicy: { select: { id: true, name: true, leaveType: true } },
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
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: {
        leavePolicy: { select: { id: true, name: true, leaveType: true, isEncashable: true } },
      },
      orderBy: { leavePolicy: { name: 'asc' } },
    });
  }

  async deductBalance(employeeId: string, leavePolicyId: string, year: number, days: number) {
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leavePolicyId_year: { employeeId, leavePolicyId, year } },
    });
    if (!balance) throw new NotFoundException('Leave balance not found for this policy/year');
    if (balance.balanceDays < days) {
      throw new BadRequestException('Insufficient leave balance');
    }

    return this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        takenDays: balance.takenDays + days,
        balanceDays: balance.balanceDays - days,
      },
    });
  }

  async restoreBalance(employeeId: string, leavePolicyId: string, year: number, days: number) {
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leavePolicyId_year: { employeeId, leavePolicyId, year } },
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
   * for policies with accrualType === 'monthly'.
   */
  @Cron('5 0 1 * *')
  async accrueMonthly() {
    const year = new Date().getFullYear();
    const policies = await this.prisma.leavePolicy.findMany({
      where: { deletedAt: null, isActive: true, accrualType: 'monthly' },
      include: {
        employees: { where: { deletedAt: null, status: 'ACTIVE' }, select: { id: true } },
      },
    });

    for (const policy of policies) {
      const monthlyAccrual = policy.daysPerYear / 12;
      for (const employee of policy.employees) {
        const balance = await this.prisma.leaveBalance.upsert({
          where: {
            employeeId_leavePolicyId_year: {
              employeeId: employee.id,
              leavePolicyId: policy.id,
              year,
            },
          },
          create: {
            employeeId: employee.id,
            leavePolicyId: policy.id,
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
          `Accrued ${monthlyAccrual} days for employee ${employee.id} policy ${policy.id} (balance ${balance.balanceDays})`,
        );
      }
    }
  }
}
