import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * superagent only auto-buffers a handful of well-known binary content types
 * into `res.body` (octet-stream, images) — xlsx/pdf mime types fall through
 * to its default parser and `res.body` stays `{}`. Any e2e test asserting on
 * the raw bytes of a binary export must pass this to `.buffer(true).parse(...)`.
 */
function binaryParser(res: any, callback: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

/**
 * Reports & Dashboard module (M17) end-to-end coverage:
 *  - Every report endpoint returns COMPUTED numbers verified against raw
 *    Prisma aggregates seeded directly in the test (not just HTTP 200).
 *  - Excel/PDF export binary shape (zip magic bytes / %PDF header).
 *  - Multi-tenancy: org A's data never leaks into org B's report totals.
 *  - departmentId cross-org validation (404, not silently empty).
 *  - Permission boundary: report:read / report:export required.
 *  - Dashboard KPIs cross-checked against the same headcount report numbers.
 *
 * Runs against the real dev MySQL/Redis instance (same as `npm run start:dev`).
 */
describe('Reports & Dashboard module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const PASSWORD = 'Test@1234';
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    for (const organizationId of createdOrgIds) {
      const employees = await prisma.employee.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const employeeIds = employees.map((e) => e.id);

      await prisma.incentiveLedger.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.leaveBalance.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.leaveApplication.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.leavePolicy.deleteMany({ where: { organizationId } });
      await prisma.attendanceLog.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.loanEmiSchedule.deleteMany({
        where: { loan: { employeeId: { in: employeeIds } } },
      });
      await prisma.loanApplication.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.payrollEntry.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.payrollRun.deleteMany({ where: { organizationId } });
      await prisma.userRole.deleteMany({ where: { user: { organizationId } } });
      await prisma.loginHistory.deleteMany({ where: { user: { organizationId } } });
      await prisma.user.deleteMany({ where: { organizationId } });
      await prisma.employee.deleteMany({ where: { organizationId } });
      await prisma.designation.deleteMany({ where: { organizationId } });
      await prisma.department.deleteMany({ where: { organizationId } });
      await prisma.payrollStructure.deleteMany({ where: { organizationId } });
      await prisma.role.deleteMany({ where: { organizationId } });
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
    await app.close();
  });

  interface OrgFixture {
    organizationId: string;
    departmentId: string;
    designationId: string;
    payrollStructureId: string;
    readerToken: string;
    noPermToken: string;
    employees: { id: string; empCode: string }[];
  }

  async function createOrgFixture(label: string, employeeCount = 2): Promise<OrgFixture> {
    const slug = `reports-e2e-${label}-${uuid()}`;
    const org = await prisma.organization.create({
      data: { name: `Reports E2E ${label}`, slug, isActive: true },
    });
    createdOrgIds.push(org.id);

    const readerRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `reports-e2e-reader-${label}`,
        description: 'Test reader role',
        permissions: ['report:read', 'report:export'],
        isSystemRole: false,
      },
    });

    const noPermRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `reports-e2e-noperm-${label}`,
        description: 'Test no-permission role',
        permissions: ['employee:read'],
        isSystemRole: false,
      },
    });

    const department = await prisma.department.create({
      data: { organizationId: org.id, name: `Dept ${label}` },
    });
    const designation = await prisma.designation.create({
      data: { organizationId: org.id, departmentId: department.id, name: `Designation ${label}` },
    });
    const payrollStructure = await prisma.payrollStructure.create({
      data: {
        organizationId: org.id,
        name: `Structure ${label}`,
        components: {
          basic: 30000,
          hra: 10000,
          specialAllowance: 0,
          educationAllowance: 0,
          travelAllowance: 0,
          otherAllowances: 0,
        },
      },
    });

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const readerEmployee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `RDR-${label}`,
        firstName: 'Reader',
        lastName: label,
        phone: '9000000001',
        departmentId: department.id,
        designationId: designation.id,
        payrollStructureId: payrollStructure.id,
        status: 'ACTIVE',
      },
    });
    const readerUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        employeeId: readerEmployee.id,
        email: `reader-${label}@reports-e2e.test`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: readerUser.id, roleId: readerRole.id } });

    const noPermEmployee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `NOP-${label}`,
        firstName: 'NoPerm',
        lastName: label,
        phone: '9000000002',
        departmentId: department.id,
        designationId: designation.id,
        payrollStructureId: payrollStructure.id,
        status: 'ACTIVE',
      },
    });
    const noPermUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        employeeId: noPermEmployee.id,
        email: `noperm-${label}@reports-e2e.test`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: noPermUser.id, roleId: noPermRole.id } });

    const employees: { id: string; empCode: string }[] = [];
    for (let i = 0; i < employeeCount; i += 1) {
      const emp = await prisma.employee.create({
        data: {
          organizationId: org.id,
          empCode: `EMP-${label}-${i}`,
          firstName: `Emp${i}`,
          lastName: label,
          phone: `900000${1000 + i}`,
          departmentId: department.id,
          designationId: designation.id,
          payrollStructureId: payrollStructure.id,
          status: 'ACTIVE',
        },
      });
      employees.push({ id: emp.id, empCode: emp.empCode });
    }

    const readerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: readerUser.email, password: PASSWORD })
      .expect(200);
    const noPermLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: noPermUser.email, password: PASSWORD })
      .expect(200);

    return {
      organizationId: org.id,
      departmentId: department.id,
      designationId: designation.id,
      payrollStructureId: payrollStructure.id,
      readerToken: readerLogin.body.data.accessToken,
      noPermToken: noPermLogin.body.data.accessToken,
      employees,
    };
  }

  function authed(token: string, organizationId: string) {
    return {
      Authorization: `Bearer ${token}`,
      'X-Organization-ID': organizationId,
    };
  }

  // ─── Headcount ──────────────────────────────────────────────────────────────

  describe('GET /reports/headcount', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('headcount', 3);
    });

    it('total matches employee.count(organizationId, deletedAt: null) and group sums add up to total', async () => {
      const expectedTotal = await prisma.employee.count({
        where: { organizationId: org.organizationId, deletedAt: null },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/headcount')
        .set(authed(org.readerToken, org.organizationId))
        .expect(200);

      const data = res.body.data;
      expect(data.total).toBe(expectedTotal);

      const deptSum = data.byDepartment.reduce((s: number, d: any) => s + d.count, 0);
      const statusSum = data.byStatus.reduce((s: number, d: any) => s + d.count, 0);
      const typeSum = data.byEmploymentType.reduce((s: number, d: any) => s + d.count, 0);
      const desigSum = data.byDesignation.reduce((s: number, d: any) => s + d.count, 0);
      expect(deptSum).toBe(expectedTotal);
      expect(statusSum).toBe(expectedTotal);
      expect(typeSum).toBe(expectedTotal);
      expect(desigSum).toBe(expectedTotal);
    });

    it('403s a user without report:read', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/headcount')
        .set(authed(org.noPermToken, org.organizationId))
        .expect(403);
    });
  });

  // ─── Multi-tenancy + departmentId cross-org validation ───────────────────────

  describe('Multi-tenancy scoping', () => {
    let orgA: OrgFixture;
    let orgB: OrgFixture;

    beforeAll(async () => {
      orgA = await createOrgFixture('tenant-a', 2);
      orgB = await createOrgFixture('tenant-b', 1);
    });

    it("org B's headcount total never includes org A's employees", async () => {
      const resA = await request(app.getHttpServer())
        .get('/api/v1/reports/headcount')
        .set(authed(orgA.readerToken, orgA.organizationId))
        .expect(200);
      const resB = await request(app.getHttpServer())
        .get('/api/v1/reports/headcount')
        .set(authed(orgB.readerToken, orgB.organizationId))
        .expect(200);

      // org A: 2 seeded + reader + noPerm = 4; org B: 1 seeded + reader + noPerm = 3
      expect(resA.body.data.total).toBe(4);
      expect(resB.body.data.total).toBe(3);
    });

    it('a departmentId belonging to another org 404s instead of returning empty results (rule #16)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/headcount')
        .query({ departmentId: orgA.departmentId })
        .set(authed(orgB.readerToken, orgB.organizationId))
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/v1/reports/loans')
        .query({ departmentId: orgA.departmentId })
        .set(authed(orgB.readerToken, orgB.organizationId))
        .expect(404);
    });

    it("org B's loans report never includes an org A loan", async () => {
      const loanA = await prisma.loanApplication.create({
        data: {
          employeeId: orgA.employees[0].id,
          amountRequested: 50000,
          amountApproved: 50000,
          status: 'ACTIVE',
        },
      });
      await prisma.loanEmiSchedule.create({
        data: {
          loanId: loanA.id,
          emiMonth: 1,
          emiYear: 2099,
          emiAmount: 5000,
          principal: 4500,
          interest: 500,
          outstandingBalance: 45500,
          dueDate: new Date('2099-01-01'),
        },
      });

      const resB = await request(app.getHttpServer())
        .get('/api/v1/reports/loans')
        .set(authed(orgB.readerToken, orgB.organizationId))
        .expect(200);

      expect(resB.body.data.rows.some((r: any) => r.loanId === loanA.id)).toBe(false);
      expect(resB.body.data.activeLoanCount).toBe(0);
    });
  });

  // ─── Loans report ───────────────────────────────────────────────────────────

  describe('GET /reports/loans', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('loans', 2);

      // Employee 0: one ACTIVE loan with a partially-deducted EMI schedule.
      const loan1 = await prisma.loanApplication.create({
        data: {
          employeeId: org.employees[0].id,
          amountRequested: 24000,
          amountApproved: 24000,
          status: 'ACTIVE',
        },
      });
      await prisma.loanEmiSchedule.createMany({
        data: [
          {
            loanId: loan1.id,
            emiMonth: 1,
            emiYear: 2050,
            emiAmount: 12000,
            principal: 12000,
            interest: 0,
            outstandingBalance: 12000,
            isDeducted: true,
            dueDate: new Date('2050-01-01'),
          },
          {
            loanId: loan1.id,
            emiMonth: 2,
            emiYear: 2050,
            emiAmount: 12000,
            principal: 12000,
            interest: 0,
            outstandingBalance: 0,
            isDeducted: false,
            dueDate: new Date('2050-02-01'),
          },
        ],
      });

      // Employee 1: a CLOSED loan (should not count toward activeLoanCount/totalOutstanding)
      const loan2 = await prisma.loanApplication.create({
        data: {
          employeeId: org.employees[1].id,
          amountRequested: 10000,
          amountApproved: 10000,
          status: 'CLOSED',
        },
      });
      await prisma.loanEmiSchedule.create({
        data: {
          loanId: loan2.id,
          emiMonth: 1,
          emiYear: 2050,
          emiAmount: 10000,
          principal: 10000,
          interest: 0,
          outstandingBalance: 0,
          isDeducted: true,
          dueDate: new Date('2050-01-01'),
        },
      });
    });

    it('activeLoanCount and totalOutstanding match the ACTIVE loans only', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/loans')
        .set(authed(org.readerToken, org.organizationId))
        .expect(200);

      expect(res.body.data.activeLoanCount).toBe(1);
      // outstanding balance = earliest not-yet-deducted EMI row's outstandingBalance = 0
      // (the un-deducted row's outstandingBalance IS 0 by our fixture, matching
      // the "remaining after this EMI" semantics used by loanOutstandingBalance)
      expect(res.body.data.totalOutstanding).toBe(0);

      const closedRow = res.body.data.rows.find((r: any) => r.status === 'CLOSED');
      expect(closedRow.outstandingBalance).toBe(0);
    });
  });

  // ─── Incentives report ────────────────────────────────────────────────────

  describe('GET /reports/incentives', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('incentives', 2);

      await prisma.incentiveLedger.createMany({
        data: [
          {
            employeeId: org.employees[0].id,
            source: 'TODO',
            totalAmount: 500,
            payrollMonth: 6,
            payrollYear: 2026,
          },
          {
            employeeId: org.employees[0].id,
            source: 'TODO',
            totalAmount: 300,
            payrollMonth: 6,
            payrollYear: 2026,
          },
          {
            employeeId: org.employees[1].id,
            source: 'TODO',
            totalAmount: 700,
            payrollMonth: 6,
            payrollYear: 2026,
          },
          // Different month - must be excluded when filtering month=6,year=2026
          {
            employeeId: org.employees[1].id,
            source: 'TODO',
            totalAmount: 999,
            payrollMonth: 5,
            payrollYear: 2026,
          },
        ],
      });
    });

    it('totalAmount equals the sum of IncentiveLedger.totalAmount for the filtered month/year', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/incentives')
        .query({ month: 6, year: 2026 })
        .set(authed(org.readerToken, org.organizationId))
        .expect(200);

      // 500 + 300 + 700 = 1500, excludes the 999 from month 5
      expect(res.body.data.totalAmount).toBe(1500);

      const emp0Row = res.body.data.rows.find((r: any) => r.employeeId === org.employees[0].id);
      expect(emp0Row.totalAmount).toBe(800);
    });
  });

  // ─── Leave report ───────────────────────────────────────────────────────────

  describe('GET /reports/leave', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('leave', 2);

      const policy = await prisma.leavePolicy.create({
        data: {
          organizationId: org.organizationId,
          name: 'Casual Leave',
          leaveType: 'CASUAL',
          daysPerYear: 12,
        },
      });

      await prisma.leaveBalance.create({
        data: {
          employeeId: org.employees[0].id,
          leavePolicyId: policy.id,
          year: 2026,
          entitledDays: 12,
          takenDays: 3,
          balanceDays: 9,
        },
      });

      await prisma.leaveApplication.createMany({
        data: [
          {
            employeeId: org.employees[0].id,
            leavePolicyId: policy.id,
            fromDate: new Date('2026-07-01'),
            toDate: new Date('2026-07-01'),
            days: 1,
            status: 'PENDING',
          },
          {
            employeeId: org.employees[1].id,
            leavePolicyId: policy.id,
            fromDate: new Date('2026-07-02'),
            toDate: new Date('2026-07-02'),
            days: 1,
            status: 'PENDING',
          },
          {
            employeeId: org.employees[1].id,
            leavePolicyId: policy.id,
            fromDate: new Date('2026-07-03'),
            toDate: new Date('2026-07-03'),
            days: 1,
            status: 'APPROVED',
          },
        ],
      });
    });

    it('pendingApplications == count of PENDING LeaveApplication, rows come from LeaveBalance', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/leave')
        .query({ year: 2026 })
        .set(authed(org.readerToken, org.organizationId))
        .expect(200);

      expect(res.body.data.pendingApplications).toBe(2);
      const row = res.body.data.rows.find((r: any) => r.employeeId === org.employees[0].id);
      expect(row.entitledDays).toBe(12);
      expect(row.takenDays).toBe(3);
      expect(row.balanceDays).toBe(9);
    });
  });

  // ─── Payroll report ─────────────────────────────────────────────────────────

  describe('GET /reports/payroll', () => {
    let org: OrgFixture;
    let runId: string;

    beforeAll(async () => {
      org = await createOrgFixture('payroll', 2);

      const run = await prisma.payrollRun.create({
        data: { organizationId: org.organizationId, month: 6, year: 2026, status: 'COMPLETED' },
      });
      runId = run.id;

      await prisma.payrollEntry.createMany({
        data: [
          {
            payrollRunId: run.id,
            employeeId: org.employees[0].id,
            workingDays: 30,
            presentDays: 30,
            basicSalary: 30000,
            hra: 10000,
            grossSalary: 40000,
            pfEmployee: 1800,
            netSalary: 38200,
          },
          {
            payrollRunId: run.id,
            employeeId: org.employees[1].id,
            workingDays: 30,
            presentDays: 29,
            lopDays: 1,
            basicSalary: 30000,
            hra: 10000,
            grossSalary: 40000,
            pfEmployee: 1800,
            netSalary: 37200,
          },
        ],
      });
    });

    it('totalDisbursed == sum(netSalary), totalGross == sum(grossSalary), component sums match', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/payroll')
        .query({ month: 6, year: 2026 })
        .set(authed(org.readerToken, org.organizationId))
        .expect(200);

      const data = res.body.data;
      expect(data.runId).toBe(runId);
      expect(data.employeeCount).toBe(2);
      expect(data.totalGross).toBe(80000);
      expect(data.totalDisbursed).toBe(38200 + 37200);
      expect(data.componentBreakdown.basicSalary).toBe(60000);
      expect(data.componentBreakdown.hra).toBe(20000);
      expect(data.componentBreakdown.pfEmployee).toBe(3600);
    });
  });

  // ─── Attendance report ──────────────────────────────────────────────────────

  describe('GET /reports/attendance', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('attendance', 2);

      const d = (n: number) => new Date(Date.UTC(2026, 5, n)); // June 2026

      await prisma.attendanceLog.createMany({
        data: [
          { employeeId: org.employees[0].id, date: d(1), status: 'PRESENT' },
          { employeeId: org.employees[0].id, date: d(2), status: 'PRESENT' },
          { employeeId: org.employees[0].id, date: d(3), status: 'ABSENT' },
          { employeeId: org.employees[1].id, date: d(1), status: 'PRESENT' },
          { employeeId: org.employees[1].id, date: d(2), status: 'ABSENT' },
        ],
      });

      const run = await prisma.payrollRun.create({
        data: { organizationId: org.organizationId, month: 6, year: 2026, status: 'COMPLETED' },
      });
      await prisma.payrollEntry.createMany({
        data: [
          {
            payrollRunId: run.id,
            employeeId: org.employees[0].id,
            workingDays: 30,
            presentDays: 28,
            lopDays: 2,
            grossSalary: 40000,
            netSalary: 38000,
          },
          {
            payrollRunId: run.id,
            employeeId: org.employees[1].id,
            workingDays: 30,
            presentDays: 29,
            lopDays: 1,
            grossSalary: 40000,
            netSalary: 39000,
          },
        ],
      });
    });

    it('totalPresent/totalAbsent match AttendanceLog counts; totalLop == sum PayrollEntry.lopDays', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/attendance')
        .query({ from: '2026-06-01', to: '2026-06-30', month: 6, year: 2026 })
        .set(authed(org.readerToken, org.organizationId))
        .expect(200);

      const data = res.body.data;
      expect(data.totalPresent).toBe(3);
      expect(data.totalAbsent).toBe(2);
      expect(data.totalLop).toBe(3);
    });
  });

  // ─── Export: Excel ──────────────────────────────────────────────────────────

  describe('GET /reports/:type/export?format=excel', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('export-excel', 2);
      const run = await prisma.payrollRun.create({
        data: { organizationId: org.organizationId, month: 6, year: 2026, status: 'COMPLETED' },
      });
      await prisma.payrollEntry.create({
        data: {
          payrollRunId: run.id,
          employeeId: org.employees[0].id,
          workingDays: 30,
          presentDays: 30,
          grossSalary: 40000,
          netSalary: 38200,
        },
      });
    });

    it('headcount excel export returns a valid xlsx (zip magic bytes) with attachment headers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/headcount/export')
        .query({ format: 'excel' })
        .set(authed(org.readerToken, org.organizationId))
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toContain('attachment');
      const buf: Buffer = res.body;
      expect(buf.length).toBeGreaterThan(0);
      expect(buf.slice(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04])); // PK\x03\x04
    });

    it('payroll excel export returns a valid xlsx', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/payroll/export')
        .query({ format: 'excel', month: 6, year: 2026 })
        .set(authed(org.readerToken, org.organizationId))
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      expect(res.headers['content-type']).toContain('spreadsheetml');
      const buf: Buffer = res.body;
      expect(buf.slice(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    });

    it('403s a user without report:export', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/headcount/export')
        .query({ format: 'excel' })
        .set(authed(org.noPermToken, org.organizationId))
        .expect(403);
    });
  });

  // ─── Export: PDF ────────────────────────────────────────────────────────────

  describe('GET /reports/:type/export?format=pdf', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('export-pdf', 1);
      const run = await prisma.payrollRun.create({
        data: { organizationId: org.organizationId, month: 6, year: 2026, status: 'COMPLETED' },
      });
      await prisma.payrollEntry.create({
        data: {
          payrollRunId: run.id,
          employeeId: org.employees[0].id,
          workingDays: 30,
          presentDays: 30,
          grossSalary: 40000,
          netSalary: 38200,
        },
      });
    });

    it('payroll pdf export returns a valid PDF (starts with %PDF)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/payroll/export')
        .query({ format: 'pdf', month: 6, year: 2026 })
        .set(authed(org.readerToken, org.organizationId))
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      const buf: Buffer = res.body;
      expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
    });

    it('headcount (non-payroll) pdf export is rejected with 400 (documented-unsupported)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/headcount/export')
        .query({ format: 'pdf' })
        .set(authed(org.readerToken, org.organizationId))
        .expect(400);
    });
  });

  // ─── Dashboard KPIs ─────────────────────────────────────────────────────────

  describe('GET /dashboards/kpis', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('kpis', 2);

      await prisma.leaveApplication.create({
        data: {
          employeeId: org.employees[0].id,
          leavePolicyId: (
            await prisma.leavePolicy.create({
              data: {
                organizationId: org.organizationId,
                name: 'CL',
                leaveType: 'CASUAL',
                daysPerYear: 12,
              },
            })
          ).id,
          fromDate: new Date(),
          toDate: new Date(),
          days: 1,
          status: 'PENDING',
        },
      });

      const loan = await prisma.loanApplication.create({
        data: {
          employeeId: org.employees[1].id,
          amountRequested: 5000,
          status: 'PENDING',
        },
      });

      const activeLoan = await prisma.loanApplication.create({
        data: {
          employeeId: org.employees[1].id,
          amountRequested: 8000,
          amountApproved: 8000,
          status: 'ACTIVE',
        },
      });
      void loan;
      void activeLoan;
    });

    it('returns real non-null counts and kpi_total_employees matches the headcount report', async () => {
      const kpiRes = await request(app.getHttpServer())
        .get('/api/v1/dashboards/kpis')
        .set(authed(org.readerToken, org.organizationId))
        .expect(200);

      const headcountRes = await request(app.getHttpServer())
        .get('/api/v1/reports/headcount')
        .set(authed(org.readerToken, org.organizationId))
        .expect(200);

      const kpis = kpiRes.body.data;
      expect(kpis.kpi_total_employees).not.toBeNull();
      expect(kpis.kpi_active_employees).not.toBeNull();
      expect(kpis.kpi_pending_approvals).not.toBeNull();
      expect(kpis.kpi_open_loans).not.toBeNull();
      expect(kpis.kpi_total_employees).toBe(headcountRes.body.data.total);
      expect(kpis.kpi_open_loans).toBe(1); // only the ACTIVE loan

      const breakdown = kpis.kpi_pending_approvals_breakdown;
      const sum = breakdown.leave + breakdown.loan + breakdown.serviceRequest + breakdown.todo;
      expect(sum).toBe(kpis.kpi_pending_approvals);
      expect(breakdown.leave).toBeGreaterThanOrEqual(1);
      expect(breakdown.loan).toBeGreaterThanOrEqual(1);
    });

    it('403s a user without report:read', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/dashboards/kpis')
        .set(authed(org.noPermToken, org.organizationId))
        .expect(403);
    });
  });
});
