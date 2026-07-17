import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoanStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { computeEmiSchedule } from './loan-amortization';
import { CreateLoanDto } from './dto/create-loan.dto';
import { QueryLoanDto } from './dto/query-loan.dto';
import { ApproveLoanDto } from './dto/approve-loan.dto';
import { RejectLoanDto } from './dto/reject-loan.dto';

export const LOAN_APPROVE_PERMISSION = 'loan:approve';

export interface RequestingUser {
  employeeId: string | null;
  permissions: string[];
}

export interface LoanDeductionForPeriod {
  totalEmi: number;
  scheduleIds: string[];
}

const LOAN_APPLICATION_WITH_EMPLOYEE = {
  employee: {
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
    },
  },
} satisfies Prisma.LoanApplicationInclude;

type LoanApplicationWithEmployee = Prisma.LoanApplicationGetPayload<{
  include: typeof LOAN_APPLICATION_WITH_EMPLOYEE;
}>;

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  private hasApprovePermission(currentUser: RequestingUser): boolean {
    return (
      currentUser.permissions.includes(LOAN_APPROVE_PERMISSION) ||
      currentUser.permissions.includes('*')
    );
  }

  async apply(organizationId: string, currentUser: RequestingUser, dto: CreateLoanDto) {
    const targetEmployeeId = dto.employeeId ?? currentUser.employeeId;
    if (!targetEmployeeId) {
      throw new BadRequestException('No employee record found for the current user');
    }

    if (
      dto.employeeId &&
      dto.employeeId !== currentUser.employeeId &&
      !this.hasApprovePermission(currentUser)
    ) {
      throw new ForbiddenException(
        'You are not permitted to apply for a loan on behalf of another employee',
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: targetEmployeeId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const loan = await this.prisma.loanApplication.create({
      data: {
        employeeId: targetEmployeeId,
        amountRequested: dto.amountRequested,
        tenureMonths: dto.tenureMonths,
        reason: dto.reason,
        status: LoanStatus.PENDING,
      },
      include: LOAN_APPLICATION_WITH_EMPLOYEE,
    });

    return this.toLoanResponse(loan);
  }

  async findAll(organizationId: string, currentUser: RequestingUser, query: QueryLoanDto) {
    const canSeeAll = this.hasApprovePermission(currentUser);
    const scopedEmployeeId = canSeeAll ? query.employeeId : currentUser.employeeId;

    if (!canSeeAll && !scopedEmployeeId) {
      return paginate([], 0, query);
    }

    const where: Prisma.LoanApplicationWhereInput = {
      employee: { organizationId, deletedAt: null },
      ...(scopedEmployeeId && { employeeId: scopedEmployeeId }),
      ...(query.status && { status: query.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.loanApplication.findMany({
        where,
        include: LOAN_APPLICATION_WITH_EMPLOYEE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.loanApplication.count({ where }),
    ]);

    return paginate(
      data.map((loan) => this.toLoanResponse(loan)),
      total,
      query,
    );
  }

  async findOne(organizationId: string, currentUser: RequestingUser, id: string) {
    const loan = await this.getLoanOrThrow(organizationId, id);
    this.assertVisible(loan, currentUser);
    return this.toLoanResponse(loan);
  }

  async approve(organizationId: string, userId: string, id: string, dto: ApproveLoanDto) {
    const loan = await this.getLoanOrThrow(organizationId, id);
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException('Only a PENDING loan application can be approved');
    }

    const amountApproved = dto.amountApproved ?? loan.amountRequested;
    const tenureMonths = dto.tenureMonths ?? loan.tenureMonths;
    if (!tenureMonths) {
      throw new BadRequestException(
        'Tenure months must be provided (none was set on the application)',
      );
    }

    const now = new Date();
    const schedule = computeEmiSchedule({
      principal: amountApproved,
      annualInterestRate: dto.interestRate,
      tenureMonths,
      startMonth: now.getMonth() + 1,
      startYear: now.getFullYear(),
    });

    const [updatedLoan] = await this.prisma.$transaction([
      this.prisma.loanApplication.update({
        where: { id },
        data: {
          amountApproved,
          interestRate: dto.interestRate,
          tenureMonths,
          approvedBy: userId,
          disbursedAt: now,
          status: LoanStatus.ACTIVE,
        },
        include: LOAN_APPLICATION_WITH_EMPLOYEE,
      }),
      this.prisma.loanEmiSchedule.createMany({
        data: schedule.map((installment) => ({
          loanId: id,
          emiMonth: installment.emiMonth,
          emiYear: installment.emiYear,
          emiAmount: installment.emiAmount,
          principal: installment.principal,
          interest: installment.interest,
          outstandingBalance: installment.outstandingBalance,
          dueDate: installment.dueDate,
        })),
      }),
    ]);

    return {
      ...this.toLoanResponse(updatedLoan),
      emiSchedule: schedule.map((installment) => ({
        installmentNo: installment.installmentNo,
        emiMonth: installment.emiMonth,
        emiYear: installment.emiYear,
        emiAmount: installment.emiAmount,
        principal: installment.principal,
        interest: installment.interest,
        outstandingBalance: installment.outstandingBalance,
        dueDate: installment.dueDate,
      })),
    };
  }

  async reject(organizationId: string, userId: string, id: string, dto: RejectLoanDto) {
    const loan = await this.getLoanOrThrow(organizationId, id);
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException('Only a PENDING loan application can be rejected');
    }

    const reason = dto.reason
      ? loan.reason
        ? `${loan.reason}\n\nRejection reason: ${dto.reason}`
        : `Rejection reason: ${dto.reason}`
      : loan.reason;

    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: {
        status: LoanStatus.REJECTED,
        approvedBy: userId,
        reason,
      },
      include: LOAN_APPLICATION_WITH_EMPLOYEE,
    });

    return this.toLoanResponse(updated);
  }

  async getEmiSchedule(organizationId: string, currentUser: RequestingUser, id: string) {
    const loan = await this.getLoanOrThrow(organizationId, id);
    this.assertVisible(loan, currentUser);

    const rows = await this.prisma.loanEmiSchedule.findMany({
      where: { loanId: id },
      orderBy: [{ emiYear: 'asc' }, { emiMonth: 'asc' }],
    });

    return rows.map((row, index) => this.toEmiScheduleResponse(row, index + 1));
  }

  /**
   * Consumed by PayrollService.processRun. Returns the sum of undeducted EMI
   * amounts due for (employeeId, month, year) on ACTIVE loans, plus the
   * schedule row ids to mark as deducted after the payroll entry is
   * persisted. Idempotent: a repeat call for an already-deducted period
   * returns { totalEmi: 0, scheduleIds: [] } because isDeducted rows are excluded.
   */
  async getActiveLoanDeductionForPeriod(
    organizationId: string,
    employeeId: string,
    month: number,
    year: number,
  ): Promise<LoanDeductionForPeriod> {
    const rows = await this.prisma.loanEmiSchedule.findMany({
      where: {
        emiMonth: month,
        emiYear: year,
        isDeducted: false,
        loan: {
          employeeId,
          status: LoanStatus.ACTIVE,
          employee: { organizationId },
        },
      },
      select: { id: true, emiAmount: true },
    });

    if (rows.length === 0) {
      return { totalEmi: 0, scheduleIds: [] };
    }

    return {
      totalEmi: rows.reduce((sum, row) => sum + row.emiAmount, 0),
      scheduleIds: rows.map((row) => row.id),
    };
  }

  /**
   * Consumed by PayrollService after persisting a PayrollEntry. Flips
   * isDeducted/payrollEntryId/paidAt on the given schedule rows, then
   * auto-closes any loan that has no remaining undeducted rows. Idempotent —
   * safe to call repeatedly with the same scheduleIds.
   */
  async markEmiDeducted(scheduleIds: string[], payrollEntryId: string): Promise<void> {
    if (scheduleIds.length === 0) return;

    const affectedRows = await this.prisma.loanEmiSchedule.findMany({
      where: { id: { in: scheduleIds } },
      select: { loanId: true },
    });
    const affectedLoanIds = [...new Set(affectedRows.map((row) => row.loanId))];

    await this.prisma.loanEmiSchedule.updateMany({
      where: { id: { in: scheduleIds } },
      data: { isDeducted: true, payrollEntryId, paidAt: new Date() },
    });

    for (const loanId of affectedLoanIds) {
      const remaining = await this.prisma.loanEmiSchedule.count({
        where: { loanId, isDeducted: false },
      });
      if (remaining === 0) {
        await this.prisma.loanApplication.updateMany({
          where: { id: loanId, status: LoanStatus.ACTIVE },
          data: { status: LoanStatus.CLOSED, closedAt: new Date() },
        });
      }
    }
  }

  /**
   * Consumed by ExitService at settlement time to reference (not recompute) an
   * employee's outstanding loan balance. Sums the `outstandingBalance` of the
   * most recent undeducted EMI row per ACTIVE loan (each row's outstandingBalance
   * already reflects the remaining principal+interest as of that installment).
   */
  async getOutstandingBalanceForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<number> {
    if (!organizationId || !employeeId) {
      throw new BadRequestException('organizationId and employeeId are required');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const activeLoans = await this.prisma.loanApplication.findMany({
      where: { employeeId, status: LoanStatus.ACTIVE, employee: { organizationId } },
      select: { id: true },
    });
    if (activeLoans.length === 0) return 0;

    let total = 0;
    for (const loan of activeLoans) {
      const nextInstallment = await this.prisma.loanEmiSchedule.findFirst({
        where: { loanId: loan.id, isDeducted: false },
        orderBy: [{ emiYear: 'asc' }, { emiMonth: 'asc' }],
        select: { outstandingBalance: true },
      });
      if (nextInstallment) total += nextInstallment.outstandingBalance;
    }
    return total;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async getLoanOrThrow(
    organizationId: string,
    id: string,
  ): Promise<LoanApplicationWithEmployee> {
    const loan = await this.prisma.loanApplication.findFirst({
      where: { id, employee: { organizationId, deletedAt: null } },
      include: LOAN_APPLICATION_WITH_EMPLOYEE,
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    return loan;
  }

  private assertVisible(loan: { employeeId: string }, currentUser: RequestingUser): void {
    if (this.hasApprovePermission(currentUser)) return;
    if (loan.employeeId !== currentUser.employeeId) {
      throw new ForbiddenException('You can only view your own loan applications');
    }
  }

  private toLoanResponse(loan: LoanApplicationWithEmployee) {
    return {
      id: loan.id,
      employeeId: loan.employeeId,
      employee: {
        id: loan.employee.id,
        empCode: loan.employee.empCode,
        firstName: loan.employee.firstName,
        lastName: loan.employee.lastName,
        departmentName: loan.employee.department?.name ?? null,
      },
      amountRequested: loan.amountRequested,
      amountApproved: loan.amountApproved,
      interestRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      status: loan.status,
      reason: loan.reason,
      approvedBy: loan.approvedBy,
      disbursedAt: loan.disbursedAt,
      closedAt: loan.closedAt,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
    };
  }

  private toEmiScheduleResponse(
    row: {
      id: string;
      loanId: string;
      emiMonth: number;
      emiYear: number;
      emiAmount: number;
      principal: number;
      interest: number;
      outstandingBalance: number;
      isDeducted: boolean;
      payrollEntryId: string | null;
      dueDate: Date;
      paidAt: Date | null;
    },
    installmentNo: number,
  ) {
    return {
      id: row.id,
      loanId: row.loanId,
      installmentNo,
      emiMonth: row.emiMonth,
      emiYear: row.emiYear,
      emiAmount: row.emiAmount,
      principal: row.principal,
      interest: row.interest,
      outstandingBalance: row.outstandingBalance,
      isDeducted: row.isDeducted,
      payrollEntryId: row.payrollEntryId,
      dueDate: row.dueDate,
      paidAt: row.paidAt,
    };
  }
}
