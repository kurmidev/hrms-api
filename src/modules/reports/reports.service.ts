import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus, LoanStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '@prisma/prisma.service';
import { QueryReportDto } from './dto/query-report.dto';
import { ReportExportFormat } from './dto/export-report.dto';

export const REPORT_TYPES = [
  'headcount',
  'attendance',
  'leave',
  'payroll',
  'loans',
  'incentives',
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

interface ExportedFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

const EXCEL_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PDF_CONTENT_TYPE = 'application/pdf';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Validates a departmentId (if supplied) belongs to the caller's organization. Rule #16. */
  private async assertDepartmentInOrg(
    organizationId: string,
    departmentId?: string,
  ): Promise<void> {
    if (!departmentId) return;
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!dept) throw new NotFoundException('Department not found');
  }

  private resolvePeriod(query: QueryReportDto): { from: Date; to: Date } {
    if (query.from || query.to) {
      const from = query.from ? new Date(query.from) : new Date(0);
      const to = query.to ? new Date(query.to) : new Date();
      return { from, to };
    }
    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { from, to };
  }

  // ─── Headcount ──────────────────────────────────────────────────────────────

  async headcount(organizationId: string, query: QueryReportDto) {
    await this.assertDepartmentInOrg(organizationId, query.departmentId);

    const where = {
      organizationId,
      deletedAt: null,
      ...(query.departmentId && { departmentId: query.departmentId }),
    };

    const [total, statusGroups, typeGroups, deptGroups, desigGroups] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.groupBy({ by: ['status'], where, _count: { status: true } }),
      this.prisma.employee.groupBy({
        by: ['employmentType'],
        where,
        _count: { employmentType: true },
      }),
      this.prisma.department.findMany({
        where: {
          organizationId,
          deletedAt: null,
          ...(query.departmentId && { id: query.departmentId }),
        },
        select: {
          id: true,
          name: true,
          _count: { select: { employees: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.designation.findMany({
        where: {
          organizationId,
          deletedAt: null,
          ...(query.departmentId && { departmentId: query.departmentId }),
        },
        select: {
          id: true,
          name: true,
          _count: { select: { employees: { where: { deletedAt: null } } } },
        },
      }),
    ]);

    return {
      total,
      byDepartment: deptGroups.map((d) => ({
        departmentId: d.id,
        departmentName: d.name,
        count: d._count.employees,
      })),
      byDesignation: desigGroups.map((d) => ({
        designationId: d.id,
        designationName: d.name,
        count: d._count.employees,
      })),
      byEmploymentType: typeGroups.map((g) => ({
        employmentType: g.employmentType,
        count: g._count.employmentType,
      })),
      byStatus: statusGroups.map((g) => ({ status: g.status, count: g._count.status })),
    };
  }

  // ─── Attendance ─────────────────────────────────────────────────────────────

  async attendance(organizationId: string, query: QueryReportDto) {
    await this.assertDepartmentInOrg(organizationId, query.departmentId);
    const { from, to } = this.resolvePeriod(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const employeeFilter = {
      organizationId,
      deletedAt: null,
      ...(query.departmentId && { departmentId: query.departmentId }),
    };

    const logWhere = {
      date: { gte: from, lte: to },
      employee: employeeFilter,
    };

    const statusGroups = await this.prisma.attendanceLog.groupBy({
      by: ['status'],
      where: logWhere,
      _count: { status: true },
    });

    const totalPresent = statusGroups.find((g) => g.status === 'PRESENT')?._count.status ?? 0;
    const totalAbsent = statusGroups.find((g) => g.status === 'ABSENT')?._count.status ?? 0;

    const lopAgg = await this.prisma.payrollEntry.aggregate({
      where: {
        employee: employeeFilter,
        payrollRun: {
          organizationId,
          ...(query.year && { year: query.year }),
          ...(query.month && { month: query.month }),
        },
      },
      _sum: { lopDays: true },
    });

    const employees = await this.prisma.employee.findMany({
      where: employeeFilter,
      select: { id: true, empCode: true, firstName: true, lastName: true },
      orderBy: { empCode: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const totalEmployees = await this.prisma.employee.count({ where: employeeFilter });

    const rows = await Promise.all(
      employees.map(async (emp) => {
        const [present, absent] = await Promise.all([
          this.prisma.attendanceLog.count({
            where: { employeeId: emp.id, date: { gte: from, lte: to }, status: 'PRESENT' },
          }),
          this.prisma.attendanceLog.count({
            where: { employeeId: emp.id, date: { gte: from, lte: to }, status: 'ABSENT' },
          }),
        ]);
        const lop = await this.prisma.payrollEntry.aggregate({
          where: {
            employeeId: emp.id,
            payrollRun: {
              organizationId,
              ...(query.year && { year: query.year }),
              ...(query.month && { month: query.month }),
            },
          },
          _sum: { lopDays: true },
        });
        return {
          employeeId: emp.id,
          empCode: emp.empCode,
          name: `${emp.firstName} ${emp.lastName}`,
          presentDays: present,
          absentDays: absent,
          lopDays: lop._sum.lopDays ?? 0,
        };
      }),
    );

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalPresent,
      totalAbsent,
      totalLop: lopAgg._sum.lopDays ?? 0,
      byStatus: statusGroups.map((g) => ({ status: g.status, count: g._count.status })),
      rows,
      meta: {
        total: totalEmployees,
        page,
        limit,
        totalPages: Math.ceil(totalEmployees / limit),
      },
    };
  }

  // ─── Leave ──────────────────────────────────────────────────────────────────

  async leave(organizationId: string, query: QueryReportDto) {
    await this.assertDepartmentInOrg(organizationId, query.departmentId);
    const year = query.year ?? new Date().getUTCFullYear();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const employeeFilter = {
      organizationId,
      deletedAt: null,
      ...(query.departmentId && { departmentId: query.departmentId }),
    };

    const [pendingApplications, total, balances] = await Promise.all([
      this.prisma.leaveApplication.count({
        where: { status: LeaveStatus.PENDING, employee: employeeFilter },
      }),
      this.prisma.leaveBalance.count({ where: { year, employee: employeeFilter } }),
      this.prisma.leaveBalance.findMany({
        where: { year, employee: employeeFilter },
        include: {
          employee: { select: { id: true, empCode: true, firstName: true, lastName: true } },
          leavePolicyType: { select: { leaveType: true } },
        },
        orderBy: { employee: { empCode: 'asc' } },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      year,
      pendingApplications,
      rows: balances.map((b) => ({
        employeeId: b.employee.id,
        empCode: b.employee.empCode,
        name: `${b.employee.firstName} ${b.employee.lastName}`,
        leavePolicyTypeId: b.leavePolicyTypeId,
        leaveType: b.leavePolicyType.leaveType,
        entitledDays: b.entitledDays,
        takenDays: b.takenDays,
        balanceDays: b.balanceDays,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Payroll ────────────────────────────────────────────────────────────────

  async payroll(organizationId: string, query: QueryReportDto) {
    await this.assertDepartmentInOrg(organizationId, query.departmentId);

    const run =
      query.month && query.year
        ? await this.prisma.payrollRun.findUnique({
            where: {
              organizationId_month_year: { organizationId, month: query.month, year: query.year },
            },
          })
        : await this.prisma.payrollRun.findFirst({
            where: { organizationId },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
          });

    if (!run) {
      const now = new Date();
      return {
        runId: null,
        month: query.month ?? now.getUTCMonth() + 1,
        year: query.year ?? now.getUTCFullYear(),
        status: null,
        employeeCount: 0,
        totalGross: 0,
        totalDisbursed: 0,
        componentBreakdown: this.emptyComponentBreakdown(),
      };
    }

    const entryWhere = {
      payrollRunId: run.id,
      ...(query.departmentId && { employee: { departmentId: query.departmentId } }),
    };

    const [count, agg] = await Promise.all([
      this.prisma.payrollEntry.count({ where: entryWhere }),
      this.prisma.payrollEntry.aggregate({
        where: entryWhere,
        _sum: {
          grossSalary: true,
          netSalary: true,
          basicSalary: true,
          hra: true,
          specialAllowance: true,
          educationAllowance: true,
          otherAllowances: true,
          incentiveAmount: true,
          overtimeAmount: true,
          travelAllowance: true,
          bonus: true,
          greenThanksAmount: true,
          pfEmployee: true,
          pfEmployer: true,
          esiEmployee: true,
          esiEmployer: true,
          professionalTax: true,
          tds: true,
          loanDeduction: true,
          advanceDeduction: true,
          otherDeductions: true,
        },
      }),
    ]);

    return {
      runId: run.id,
      month: run.month,
      year: run.year,
      status: run.status,
      employeeCount: count,
      totalGross: agg._sum.grossSalary ?? 0,
      totalDisbursed: agg._sum.netSalary ?? 0,
      componentBreakdown: {
        basicSalary: agg._sum.basicSalary ?? 0,
        hra: agg._sum.hra ?? 0,
        specialAllowance: agg._sum.specialAllowance ?? 0,
        educationAllowance: agg._sum.educationAllowance ?? 0,
        otherAllowances: agg._sum.otherAllowances ?? 0,
        incentiveAmount: agg._sum.incentiveAmount ?? 0,
        overtimeAmount: agg._sum.overtimeAmount ?? 0,
        travelAllowance: agg._sum.travelAllowance ?? 0,
        bonus: agg._sum.bonus ?? 0,
        greenThanksAmount: agg._sum.greenThanksAmount ?? 0,
        pfEmployee: agg._sum.pfEmployee ?? 0,
        pfEmployer: agg._sum.pfEmployer ?? 0,
        esiEmployee: agg._sum.esiEmployee ?? 0,
        esiEmployer: agg._sum.esiEmployer ?? 0,
        professionalTax: agg._sum.professionalTax ?? 0,
        tds: agg._sum.tds ?? 0,
        loanDeduction: agg._sum.loanDeduction ?? 0,
        advanceDeduction: agg._sum.advanceDeduction ?? 0,
        otherDeductions: agg._sum.otherDeductions ?? 0,
      },
    };
  }

  private emptyComponentBreakdown() {
    return {
      basicSalary: 0,
      hra: 0,
      specialAllowance: 0,
      educationAllowance: 0,
      otherAllowances: 0,
      incentiveAmount: 0,
      overtimeAmount: 0,
      travelAllowance: 0,
      bonus: 0,
      greenThanksAmount: 0,
      pfEmployee: 0,
      pfEmployer: 0,
      esiEmployee: 0,
      esiEmployer: 0,
      professionalTax: 0,
      tds: 0,
      loanDeduction: 0,
      advanceDeduction: 0,
      otherDeductions: 0,
    };
  }

  // ─── Loans ──────────────────────────────────────────────────────────────────

  /**
   * Remaining principal+interest for a loan: the outstandingBalance of the
   * earliest not-yet-deducted EMI row (mirrors LoansService.getOutstandingBalanceForEmployee).
   */
  private async loanOutstandingBalance(loanId: string): Promise<number> {
    const nextInstallment = await this.prisma.loanEmiSchedule.findFirst({
      where: { loanId, isDeducted: false },
      orderBy: [{ emiYear: 'asc' }, { emiMonth: 'asc' }],
      select: { outstandingBalance: true },
    });
    return nextInstallment?.outstandingBalance ?? 0;
  }

  async loans(organizationId: string, query: QueryReportDto) {
    await this.assertDepartmentInOrg(organizationId, query.departmentId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const employeeFilter = {
      organizationId,
      ...(query.departmentId && { departmentId: query.departmentId }),
    };

    const [activeLoanCount, total, loans] = await Promise.all([
      this.prisma.loanApplication.count({
        where: { status: LoanStatus.ACTIVE, employee: employeeFilter },
      }),
      this.prisma.loanApplication.count({ where: { employee: employeeFilter } }),
      this.prisma.loanApplication.findMany({
        where: { employee: employeeFilter },
        include: {
          employee: { select: { id: true, empCode: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const rows = await Promise.all(
      loans.map(async (loan) => ({
        loanId: loan.id,
        employeeId: loan.employee.id,
        empCode: loan.employee.empCode,
        name: `${loan.employee.firstName} ${loan.employee.lastName}`,
        amountRequested: loan.amountRequested,
        amountApproved: loan.amountApproved,
        status: loan.status,
        outstandingBalance:
          loan.status === LoanStatus.ACTIVE ? await this.loanOutstandingBalance(loan.id) : 0,
      })),
    );

    const activeLoans = await this.prisma.loanApplication.findMany({
      where: { status: LoanStatus.ACTIVE, employee: employeeFilter },
      select: { id: true },
    });
    const outstandingBalances = await Promise.all(
      activeLoans.map((l) => this.loanOutstandingBalance(l.id)),
    );
    const totalOutstanding = outstandingBalances.reduce((sum, v) => sum + v, 0);

    return {
      activeLoanCount,
      totalOutstanding,
      rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Incentives ─────────────────────────────────────────────────────────────

  async incentives(organizationId: string, query: QueryReportDto) {
    await this.assertDepartmentInOrg(organizationId, query.departmentId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const employeeFilter = {
      organizationId,
      ...(query.departmentId && { departmentId: query.departmentId }),
    };

    const ledgerWhere = {
      employee: employeeFilter,
      ...(query.month && { payrollMonth: query.month }),
      ...(query.year && { payrollYear: query.year }),
    };

    const grouped = await this.prisma.incentiveLedger.groupBy({
      by: ['employeeId', 'payrollMonth', 'payrollYear'],
      where: ledgerWhere,
      _sum: { totalAmount: true },
      orderBy: [{ payrollYear: 'desc' }, { payrollMonth: 'desc' }],
    });

    const totalAgg = await this.prisma.incentiveLedger.aggregate({
      where: ledgerWhere,
      _sum: { totalAmount: true },
    });

    const total = grouped.length;
    const page_ = grouped.slice((page - 1) * limit, (page - 1) * limit + limit);

    const employeeIds = [...new Set(page_.map((g) => g.employeeId))];
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, empCode: true, firstName: true, lastName: true },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    return {
      month: query.month ?? null,
      year: query.year ?? null,
      totalAmount: totalAgg._sum.totalAmount ?? 0,
      rows: page_.map((g) => {
        const emp = employeeMap.get(g.employeeId);
        return {
          employeeId: g.employeeId,
          empCode: emp?.empCode ?? '',
          name: emp ? `${emp.firstName} ${emp.lastName}` : '',
          payrollMonth: g.payrollMonth,
          payrollYear: g.payrollYear,
          totalAmount: g._sum.totalAmount ?? 0,
        };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Export ─────────────────────────────────────────────────────────────────

  async export(
    organizationId: string,
    type: string,
    format: ReportExportFormat | undefined,
    query: QueryReportDto,
  ): Promise<ExportedFile> {
    if (!REPORT_TYPES.includes(type as ReportType)) {
      throw new BadRequestException(
        `Unknown report type '${type}'. Expected one of: ${REPORT_TYPES.join(', ')}`,
      );
    }
    const resolvedFormat: ReportExportFormat = format ?? 'excel';
    if (resolvedFormat !== 'excel' && resolvedFormat !== 'pdf') {
      throw new BadRequestException("format must be 'excel' or 'pdf'");
    }

    const reportType = type as ReportType;
    const timestamp = new Date().toISOString().slice(0, 10);

    if (resolvedFormat === 'pdf') {
      if (reportType !== 'payroll') {
        throw new BadRequestException(
          `PDF export is not yet implemented for '${reportType}' reports — only 'payroll' ` +
            'supports PDF today. Use format=excel, or see the follow-up ticket to extend ' +
            'pdfkit generation to the remaining report types.',
        );
      }
      const data = await this.payroll(organizationId, query);
      const buffer = await this.buildPayrollPdf(data);
      return {
        buffer,
        filename: `payroll-report-${timestamp}.pdf`,
        contentType: PDF_CONTENT_TYPE,
      };
    }

    const buffer = await this.buildExcel(organizationId, reportType, query);
    return {
      buffer,
      filename: `${reportType}-report-${timestamp}.xlsx`,
      contentType: EXCEL_CONTENT_TYPE,
    };
  }

  private async buildExcel(
    organizationId: string,
    type: ReportType,
    query: QueryReportDto,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(type);

    switch (type) {
      case 'headcount': {
        const data = await this.headcount(organizationId, {
          ...query,
          page: 1,
          limit: 100000,
        } as QueryReportDto);
        sheet.columns = [
          { header: 'Department', key: 'department', width: 25 },
          { header: 'Count', key: 'count', width: 10 },
        ];
        sheet.addRow({ department: 'TOTAL', count: data.total });
        for (const d of data.byDepartment) {
          sheet.addRow({ department: d.departmentName, count: d.count });
        }
        break;
      }
      case 'attendance': {
        const data = await this.attendance(organizationId, {
          ...query,
          page: 1,
          limit: 100000,
        } as QueryReportDto);
        sheet.columns = [
          { header: 'Emp Code', key: 'empCode', width: 15 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Present Days', key: 'presentDays', width: 15 },
          { header: 'Absent Days', key: 'absentDays', width: 15 },
          { header: 'LOP Days', key: 'lopDays', width: 12 },
        ];
        data.rows.forEach((r) => sheet.addRow(r));
        break;
      }
      case 'leave': {
        const data = await this.leave(organizationId, {
          ...query,
          page: 1,
          limit: 100000,
        } as QueryReportDto);
        sheet.columns = [
          { header: 'Emp Code', key: 'empCode', width: 15 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Leave Type', key: 'leaveType', width: 15 },
          { header: 'Entitled Days', key: 'entitledDays', width: 15 },
          { header: 'Taken Days', key: 'takenDays', width: 15 },
          { header: 'Balance Days', key: 'balanceDays', width: 15 },
        ];
        data.rows.forEach((r) => sheet.addRow(r));
        break;
      }
      case 'payroll': {
        const data = await this.payroll(organizationId, query);
        sheet.columns = [
          { header: 'Component', key: 'component', width: 25 },
          { header: 'Amount', key: 'amount', width: 15 },
        ];
        sheet.addRow({ component: 'Total Gross', amount: data.totalGross });
        sheet.addRow({ component: 'Total Disbursed (Net)', amount: data.totalDisbursed });
        for (const [key, value] of Object.entries(data.componentBreakdown)) {
          sheet.addRow({ component: key, amount: value });
        }
        break;
      }
      case 'loans': {
        const data = await this.loans(organizationId, {
          ...query,
          page: 1,
          limit: 100000,
        } as QueryReportDto);
        sheet.columns = [
          { header: 'Emp Code', key: 'empCode', width: 15 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Amount Requested', key: 'amountRequested', width: 18 },
          { header: 'Amount Approved', key: 'amountApproved', width: 18 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Outstanding Balance', key: 'outstandingBalance', width: 18 },
        ];
        data.rows.forEach((r) => sheet.addRow(r));
        break;
      }
      case 'incentives': {
        const data = await this.incentives(organizationId, {
          ...query,
          page: 1,
          limit: 100000,
        } as QueryReportDto);
        sheet.columns = [
          { header: 'Emp Code', key: 'empCode', width: 15 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Month', key: 'payrollMonth', width: 10 },
          { header: 'Year', key: 'payrollYear', width: 10 },
          { header: 'Total Amount', key: 'totalAmount', width: 15 },
        ];
        data.rows.forEach((r) => sheet.addRow(r));
        break;
      }
    }

    sheet.getRow(1).font = { bold: true };
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private buildPayrollPdf(data: Awaited<ReturnType<ReportsService['payroll']>>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Payroll Summary Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(11);
      doc.text(`Period: ${data.month}/${data.year}`);
      doc.text(`Run status: ${data.status ?? 'N/A'}`);
      doc.text(`Employees paid: ${data.employeeCount}`);
      doc.moveDown();
      doc.fontSize(13).text('Totals', { underline: true });
      doc.fontSize(11);
      doc.text(`Total gross salary: ${data.totalGross.toFixed(2)}`);
      doc.text(`Total net disbursed: ${data.totalDisbursed.toFixed(2)}`);
      doc.moveDown();
      doc.fontSize(13).text('Component Breakdown', { underline: true });
      doc.fontSize(11);
      for (const [key, value] of Object.entries(data.componentBreakdown)) {
        doc.text(`${key}: ${Number(value).toFixed(2)}`);
      }

      doc.end();
    });
  }
}
