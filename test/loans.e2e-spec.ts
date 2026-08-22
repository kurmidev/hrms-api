import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PayrollService } from '../src/modules/payroll/payroll.service';

/**
 * Loans module (M10) end-to-end coverage:
 *  - EMI schedule generation persists correctly on approve()
 *  - Payroll <-> Loans wiring: loanDeduction actually flows into PayrollEntry,
 *    EMI rows flip isDeducted, loan auto-closes on final EMI, re-runs don't
 *    double-deduct.
 *  - Multi-tenancy: an org's loans are invisible/unapprovable from another org.
 *  - Own-vs-all visibility on GET /loans.
 *
 * Runs against the real dev MySQL/Redis instance (same as `npm run start:dev`).
 * All fixtures are created under freshly generated orgs/uuids per run and
 * cleaned up in afterAll.
 */
describe('Loans module (e2e)', () => {
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
    // Cascade cleanup: PayrollEntry/LoanEmiSchedule/LoanApplication cascade
    // from Employee/PayrollRun deletes via onDelete: Cascade where declared;
    // delete explicitly in dependency order to be safe.
    for (const organizationId of createdOrgIds) {
      const employees = await prisma.employee.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const employeeIds = employees.map((e) => e.id);

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
    approverToken: string;
    approverPermissions: string[];
    employeeUserId: string;
    employeeId: string;
    employeeToken: string;
  }

  async function createOrgFixture(label: string): Promise<OrgFixture> {
    const slug = `loans-e2e-${label}-${uuid()}`;
    const org = await prisma.organization.create({
      data: { name: `Loans E2E ${label}`, slug, isActive: true },
    });
    createdOrgIds.push(org.id);

    const approverRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `loans-e2e-approver-${label}`,
        description: 'Test approver role',
        permissions: ['loan:read', 'loan:apply', 'loan:approve', 'payroll:run', 'payroll:read'],
        isSystemRole: false,
      },
    });

    const employeeRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `loans-e2e-employee-${label}`,
        description: 'Test employee role',
        permissions: ['loan:read', 'loan:apply'],
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

    // Approver user (no employee record needed for approving, but give one so login works cleanly)
    const approverEmployee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `APR-${label}`,
        firstName: 'Approver',
        lastName: label,
        phone: '9000000001',
        departmentId: department.id,
        designationId: designation.id,
        payrollStructureId: payrollStructure.id,
        status: 'ACTIVE',
      },
    });
    const approverUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        employeeId: approverEmployee.id,
        email: `approver-${label}@loans-e2e.test`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: approverUser.id, roleId: approverRole.id } });

    // Applicant employee/user
    const employee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `EMP-${label}`,
        firstName: 'Applicant',
        lastName: label,
        phone: '9000000002',
        departmentId: department.id,
        designationId: designation.id,
        payrollStructureId: payrollStructure.id,
        status: 'ACTIVE',
      },
    });
    const employeeUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        employeeId: employee.id,
        email: `employee-${label}@loans-e2e.test`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: employeeUser.id, roleId: employeeRole.id } });

    const approverLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: approverUser.email, password: PASSWORD })
      .expect(200);

    const employeeLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: employeeUser.email, password: PASSWORD })
      .expect(200);

    return {
      organizationId: org.id,
      departmentId: department.id,
      designationId: designation.id,
      payrollStructureId: payrollStructure.id,
      approverToken: approverLogin.body.data.accessToken,
      approverPermissions: [
        'loan:read',
        'loan:apply',
        'loan:approve',
        'payroll:run',
        'payroll:read',
      ],
      employeeUserId: employeeUser.id,
      employeeId: employee.id,
      employeeToken: employeeLogin.body.data.accessToken,
    };
  }

  function authed(token: string, organizationId: string) {
    return {
      Authorization: `Bearer ${token}`,
      'X-Organization-ID': organizationId,
    };
  }

  // ─── POST /loans (loan:apply) + GET /loans (own vs all) ─────────────────────

  describe('POST /loans + GET /loans visibility', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('visibility');
    });

    it('creates a PENDING loan application for the caller own employee record', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/loans')
        .set(authed(org.employeeToken, org.organizationId))
        .send({ amountRequested: 60000, tenureMonths: 6, reason: 'Home renovation' })
        .expect(201);

      // Actual envelope (see TransformInterceptor) is { status, message, data }
      // NOT { success, data, timestamp } as CLAUDE.md's Response Pipeline section
      // claims — verified against the real running response, see known-issues.md.
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.employeeId).toBe(org.employeeId);
      expect(res.body.data.amountRequested).toBe(60000);
    });

    it('employee without loan:approve sees only their own loans on GET /loans', async () => {
      // Approver applies for a loan too (has approve perm, counts as "sees all")
      await request(app.getHttpServer())
        .post('/api/v1/loans')
        .set(authed(org.approverToken, org.organizationId))
        .send({ amountRequested: 20000, tenureMonths: 4 })
        .expect(201);

      const employeeView = await request(app.getHttpServer())
        .get('/api/v1/loans')
        .set(authed(org.employeeToken, org.organizationId))
        .expect(200);

      // Paginated list responses nest as { status, message, data: { data: [...], meta } }
      expect(
        employeeView.body.data.data.every((loan: any) => loan.employeeId === org.employeeId),
      ).toBe(true);
      expect(employeeView.body.data.data.length).toBe(1);

      const approverView = await request(app.getHttpServer())
        .get('/api/v1/loans')
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);

      // approver has loan:approve -> sees ALL loans in the org (both applications)
      expect(approverView.body.data.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Multi-tenancy ────────────────────────────────────────────────────────

  describe('Multi-tenancy scoping', () => {
    let orgA: OrgFixture;
    let orgB: OrgFixture;
    let loanIdInOrgA: string;

    beforeAll(async () => {
      orgA = await createOrgFixture('tenant-a');
      orgB = await createOrgFixture('tenant-b');

      const created = await request(app.getHttpServer())
        .post('/api/v1/loans')
        .set(authed(orgA.employeeToken, orgA.organizationId))
        .send({ amountRequested: 15000, tenureMonths: 3 })
        .expect(201);
      loanIdInOrgA = created.body.data.id;
    });

    it('org B approver cannot see org A loan via GET /loans/:id (404, not leaked)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/loans/${loanIdInOrgA}`)
        .set(authed(orgB.approverToken, orgB.organizationId))
        .expect(404);
    });

    it('org B approver cannot approve org A loan (404, not leaked)', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/loans/${loanIdInOrgA}/approve`)
        .set(authed(orgB.approverToken, orgB.organizationId))
        .send({ interestRate: 10 })
        .expect(404);
    });

    it("org B's loan list never includes org A's loan", async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/loans')
        .set(authed(orgB.approverToken, orgB.organizationId))
        .expect(200);

      expect(list.body.data.data.some((loan: any) => loan.id === loanIdInOrgA)).toBe(false);
    });
  });

  // ─── Approve -> EMI schedule persistence + reject ────────────────────────────

  describe('PUT /loans/:id/approve — EMI schedule generation & persistence', () => {
    let org: OrgFixture;
    let loanId: string;

    beforeAll(async () => {
      org = await createOrgFixture('approve-math');
      const created = await request(app.getHttpServer())
        .post('/api/v1/loans')
        .set(authed(org.employeeToken, org.organizationId))
        .send({ amountRequested: 100000, tenureMonths: 12, reason: 'Education' })
        .expect(201);
      loanId = created.body.data.id;
    });

    it('approves and persists a schedule matching the amortization ground truth', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/loans/${loanId}/approve`)
        .set(authed(org.approverToken, org.organizationId))
        .send({ interestRate: 12 })
        .expect(200);

      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.amountApproved).toBe(100000);
      expect(res.body.data.disbursedAt).not.toBeNull();

      const scheduleRes = await request(app.getHttpServer())
        .get(`/api/v1/loans/${loanId}/emi-schedule`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);

      const schedule = scheduleRes.body.data;
      expect(schedule).toHaveLength(12); // == tenureMonths

      const monthlyRate = 12 / 12 / 100;
      let expectedOutstanding = 100000;
      for (let i = 0; i < schedule.length; i += 1) {
        const row = schedule[i];
        const expectedInterest = Math.round(expectedOutstanding * monthlyRate * 100) / 100;
        expect(row.interest).toBeCloseTo(expectedInterest, 2);

        if (i === schedule.length - 1) {
          expect(row.outstandingBalance).toBe(0); // final row EXACTLY 0
        }
        expectedOutstanding = row.outstandingBalance;
      }

      const totalPrincipal = schedule.reduce((sum: number, row: any) => sum + row.principal, 0);
      expect(Math.round(totalPrincipal * 100) / 100).toBe(100000); // sums exactly to amountApproved

      // month/year rolls forward sequentially from month-after-approval
      for (let i = 1; i < schedule.length; i += 1) {
        const prev = { month: schedule[i - 1].emiMonth, year: schedule[i - 1].emiYear };
        const cur = { month: schedule[i].emiMonth, year: schedule[i].emiYear };
        const expectedNext =
          prev.month === 12
            ? { month: 1, year: prev.year + 1 }
            : { month: prev.month + 1, year: prev.year };
        expect(cur).toEqual(expectedNext);
      }
    });

    it('rejects a non-PENDING loan re-approval attempt with 400', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/loans/${loanId}/approve`)
        .set(authed(org.approverToken, org.organizationId))
        .send({ interestRate: 10 })
        .expect(400);
    });
  });

  describe('PUT /loans/:id/reject', () => {
    it('rejects a PENDING loan application', async () => {
      const org = await createOrgFixture('reject');
      const created = await request(app.getHttpServer())
        .post('/api/v1/loans')
        .set(authed(org.employeeToken, org.organizationId))
        .send({ amountRequested: 5000, tenureMonths: 2 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .put(`/api/v1/loans/${created.body.data.id}/reject`)
        .set(authed(org.approverToken, org.organizationId))
        .send({ reason: 'Not eligible yet' })
        .expect(200);

      expect(res.body.data.status).toBe('REJECTED');
    });
  });

  // ─── Maker-checker: self-approval guard (hrms-backend.md §26) ───────────────

  describe('Maker-checker: self-approval guard', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('self-approval');
      // Grant the applicant's own user the SAME approve permission the
      // approver holds, to prove the guard fires on identity, not permission.
      const approverRole = await prisma.role.findFirstOrThrow({
        where: { organizationId: org.organizationId, name: 'loans-e2e-approver-self-approval' },
      });
      await prisma.userRole.create({
        data: { userId: org.employeeUserId, roleId: approverRole.id },
      });
      // Re-login to pick up the newly-flattened permission in the JWT.
      const relogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `employee-self-approval@loans-e2e.test`, password: PASSWORD })
        .expect(200);
      org = { ...org, employeeToken: relogin.body.data.accessToken };
    });

    it('the applicant, even holding loan:approve, gets 403 approving their own loan', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/loans')
        .set(authed(org.employeeToken, org.organizationId))
        .send({ amountRequested: 8000, tenureMonths: 4 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .put(`/api/v1/loans/${created.body.data.id}/approve`)
        .set(authed(org.employeeToken, org.organizationId))
        .send({ interestRate: 10 })
        .expect(403);
      expect(res.body.message).toMatch(/own/i);
    });

    it('the applicant, even holding loan:approve, gets 403 rejecting their own loan', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/loans')
        .set(authed(org.employeeToken, org.organizationId))
        .send({ amountRequested: 3000, tenureMonths: 2 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .put(`/api/v1/loans/${created.body.data.id}/reject`)
        .set(authed(org.employeeToken, org.organizationId))
        .send({ reason: 'Self reject attempt' })
        .expect(403);
      expect(res.body.message).toMatch(/own/i);
    });

    it('a DIFFERENT user holding loan:approve can approve the same applicant loan normally', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/loans')
        .set(authed(org.employeeToken, org.organizationId))
        .send({ amountRequested: 5000, tenureMonths: 5 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .put(`/api/v1/loans/${created.body.data.id}/approve`)
        .set(authed(org.approverToken, org.organizationId))
        .send({ interestRate: 8 })
        .expect(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });
  });

  // ─── THE PAYROLL INTEGRATION ─────────────────────────────────────────────────

  describe('Payroll <-> Loans integration', () => {
    let org: OrgFixture;
    let loanId: string;
    let dueMonth: number;
    let dueYear: number;
    let firstEmiAmount: number;

    beforeAll(async () => {
      org = await createOrgFixture('payroll-integration');

      const created = await request(app.getHttpServer())
        .post('/api/v1/loans')
        .set(authed(org.employeeToken, org.organizationId))
        .send({ amountRequested: 12000, tenureMonths: 2, reason: 'Payroll wiring test' })
        .expect(201);
      loanId = created.body.data.id;

      // 0% interest for a clean, exact assertion: 12000 / 2 = 6000/month
      const approveRes = await request(app.getHttpServer())
        .put(`/api/v1/loans/${loanId}/approve`)
        .set(authed(org.approverToken, org.organizationId))
        .send({ interestRate: 0 })
        .expect(200);
      expect(approveRes.body.data.status).toBe('ACTIVE');

      const scheduleRes = await request(app.getHttpServer())
        .get(`/api/v1/loans/${loanId}/emi-schedule`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);

      const firstInstallment = scheduleRes.body.data[0];
      dueMonth = firstInstallment.emiMonth;
      dueYear = firstInstallment.emiYear;
      firstEmiAmount = firstInstallment.emiAmount;
      expect(firstEmiAmount).toBe(6000);
    });

    it('a payroll run for the EMI-due period produces a non-zero loanDeduction equal to the EMI, and reduces netSalary', async () => {
      const runRes = await request(app.getHttpServer())
        .post('/api/v1/payroll/runs')
        .set(authed(org.approverToken, org.organizationId))
        .send({ month: dueMonth, year: dueYear, employeeIds: [org.employeeId] })
        .expect(201);

      expect(runRes.body.data.status).toBe('COMPLETED');
      const runId = runRes.body.data.id;

      const entryRes = await request(app.getHttpServer())
        .get(`/api/v1/payroll/runs/${runId}/entries/${org.employeeId}`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);

      const entry = entryRes.body.data;
      expect(entry.loanDeduction).toBe(6000); // NOT 0
      expect(entry.grossSalary).toBe(40000); // basic 30000 + hra 10000
      // netSalary = gross - pf(1800, since 40000>=15000) - esi(0, since 40000>=21001) - lop(0) - loanDeduction(6000)
      expect(entry.netSalary).toBe(40000 - 1800 - 0 - 0 - 6000);

      // Schedule row flips isDeducted + payrollEntryId
      const scheduleAfter = await request(app.getHttpServer())
        .get(`/api/v1/loans/${loanId}/emi-schedule`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);
      const firstRow = scheduleAfter.body.data.find(
        (row: any) => row.emiMonth === dueMonth && row.emiYear === dueYear,
      );
      expect(firstRow.isDeducted).toBe(true);
      expect(firstRow.payrollEntryId).toBe(entry.id);

      // Loan still ACTIVE (one EMI remains)
      const loanAfterFirstRun = await request(app.getHttpServer())
        .get(`/api/v1/loans/${loanId}`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);
      expect(loanAfterFirstRun.body.data.status).toBe('ACTIVE');
    });

    it('re-running processRun for the SAME period does not double-deduct (idempotent)', async () => {
      // Duplicate initiateRun for the same (month, year) is blocked at the API
      // level by a unique constraint (409) — that's one guard. The deeper
      // guarantee the plan calls out is that PayrollService.processRun itself
      // is idempotent (getActiveLoanDeductionForPeriod excludes isDeducted
      // rows), so re-invoke processRun directly against the same run.
      await request(app.getHttpServer())
        .post('/api/v1/payroll/runs')
        .set(authed(org.approverToken, org.organizationId))
        .send({ month: dueMonth, year: dueYear, employeeIds: [org.employeeId] })
        .expect(409);

      const runBefore = await request(app.getHttpServer())
        .get('/api/v1/payroll/runs')
        .set(authed(org.approverToken, org.organizationId))
        .query({ month: dueMonth, year: dueYear })
        .expect(200);
      const runId = runBefore.body.data.data.find(
        (run: any) => run.month === dueMonth && run.year === dueYear,
      ).id;

      const payrollService = app.get(PayrollService);
      await payrollService.processRun(org.organizationId, runId, [org.employeeId]);

      const entryRes = await request(app.getHttpServer())
        .get(`/api/v1/payroll/runs/${runId}/entries/${org.employeeId}`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);
      // Still 6000, NOT 12000 — a second pass must contribute 0 additional EMI
      expect(entryRes.body.data.loanDeduction).toBe(6000);
    });

    it('final EMI deduction auto-closes the loan (status -> CLOSED)', async () => {
      const nextMonth = dueMonth === 12 ? 1 : dueMonth + 1;
      const nextYear = dueMonth === 12 ? dueYear + 1 : dueYear;

      const runRes = await request(app.getHttpServer())
        .post('/api/v1/payroll/runs')
        .set(authed(org.approverToken, org.organizationId))
        .send({ month: nextMonth, year: nextYear, employeeIds: [org.employeeId] })
        .expect(201);

      const entryRes = await request(app.getHttpServer())
        .get(`/api/v1/payroll/runs/${runRes.body.data.id}/entries/${org.employeeId}`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);
      expect(entryRes.body.data.loanDeduction).toBe(6000); // second (final) EMI

      const loanAfter = await request(app.getHttpServer())
        .get(`/api/v1/loans/${loanId}`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);
      expect(loanAfter.body.data.status).toBe('CLOSED');
      expect(loanAfter.body.data.closedAt).not.toBeNull();
    });
  });
});
