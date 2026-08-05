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
 * Incentives & Todos module (M11) end-to-end coverage:
 *  - Full pipeline: rule -> todo -> submit -> approve -> ledger -> payroll gross.
 *  - Hold/release path: held incentives excluded from payroll until released.
 *  - Idempotency: re-running processRun for the same period does not
 *    double-deduct/double-count the incentive (analogous to loans.e2e-spec.ts).
 *  - Permission boundary: todo:create-only users cannot manage rules or
 *    approve todos; GET /todos scopes to own records without todo:approve.
 *
 * Runs against the real dev MySQL/Redis instance (same as `npm run start:dev`).
 */
describe('Incentives & Todos module (e2e)', () => {
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
      await prisma.todoTask.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.incentiveRule.deleteMany({ where: { organizationId } });
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
    approverToken: string;
    employeeUserId: string;
    employeeId: string;
    employeeToken: string;
  }

  async function createOrgFixture(label: string): Promise<OrgFixture> {
    const slug = `incentives-e2e-${label}-${uuid()}`;
    const org = await prisma.organization.create({
      data: { name: `Incentives E2E ${label}`, slug, isActive: true },
    });
    createdOrgIds.push(org.id);

    const approverRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `incentives-e2e-approver-${label}`,
        description: 'Test approver role',
        permissions: ['todo:create', 'todo:approve', 'payroll:read', 'payroll:run'],
        isSystemRole: false,
      },
    });

    const employeeRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `incentives-e2e-employee-${label}`,
        description: 'Test employee role (todo:create only)',
        permissions: ['todo:create'],
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
        email: `approver-${label}@incentives-e2e.test`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: approverUser.id, roleId: approverRole.id } });

    const employee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `EMP-${label}`,
        firstName: 'FieldAgent',
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
        email: `employee-${label}@incentives-e2e.test`,
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
      approverToken: approverLogin.body.data.accessToken,
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

  async function createRule(org: OrgFixture, rate: number, label: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/incentive-rules')
      .set(authed(org.approverToken, org.organizationId))
      .send({ name: `Rule ${label}`, type: 'per_unit', rate })
      .expect(201);
    return res.body.data;
  }

  async function createSubmittedTodo(
    org: OrgFixture,
    ruleId: string,
    quantity: number,
  ): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/v1/todos')
      .set(authed(org.employeeToken, org.organizationId))
      .send({ title: 'Deliver parcels', incentiveRuleId: ruleId, quantity, unit: 'parcels' })
      .expect(201);
    const todoId = created.body.data.id;

    await request(app.getHttpServer())
      .put(`/api/v1/todos/${todoId}/submit`)
      .set(authed(org.employeeToken, org.organizationId))
      .send({ quantity, unit: 'parcels' })
      .expect(200);

    return todoId;
  }

  // ─── FULL PIPELINE ────────────────────────────────────────────────────────

  describe('Full pipeline: rule -> todo -> submit -> approve -> payroll', () => {
    let org: OrgFixture;
    let ruleId: string;
    let todoId: string;
    let ledgerId: string;
    let totalAmount: number;
    let payrollMonth: number;
    let payrollYear: number;
    const QUANTITY = 20;
    const RATE = 50;

    beforeAll(async () => {
      org = await createOrgFixture('pipeline');
      const rule = await createRule(org, RATE, 'pipeline');
      ruleId = rule.id;
      todoId = await createSubmittedTodo(org, ruleId, QUANTITY);
    });

    it('approves the SUBMITTED todo (hold=false) and creates a released, non-held ledger row', async () => {
      const now = new Date();
      payrollMonth = now.getMonth() + 1;
      payrollYear = now.getFullYear();

      const approveRes = await request(app.getHttpServer())
        .put(`/api/v1/todos/${todoId}/approve`)
        .set(authed(org.approverToken, org.organizationId))
        .send({ approve: true, hold: false, payrollMonth, payrollYear })
        .expect(200);
      expect(approveRes.body.data.status).toBe('APPROVED');

      const ledgerRes = await request(app.getHttpServer())
        .get('/api/v1/incentive-ledger')
        .set(authed(org.approverToken, org.organizationId))
        .query({ payrollMonth, payrollYear })
        .expect(200);

      const ledgerRow = ledgerRes.body.data.data.find((row: any) => row.todo?.id === todoId);
      expect(ledgerRow).toBeDefined();
      totalAmount = QUANTITY * RATE;
      ledgerId = ledgerRow.id;

      expect(ledgerRow.totalAmount).toBe(totalAmount);
      expect(ledgerRow.isReleased).toBe(true);
      expect(ledgerRow.isHeld).toBe(false);
      expect(ledgerRow.isDeducted).toBe(false);
    });

    it('running payroll for that month/year includes the incentive in incentiveAmount and grossSalary', async () => {
      const runRes = await request(app.getHttpServer())
        .post('/api/v1/payroll/runs')
        .set(authed(org.approverToken, org.organizationId))
        .send({ month: payrollMonth, year: payrollYear, employeeIds: [org.employeeId] })
        .expect(201);
      expect(runRes.body.data.status).toBe('COMPLETED');
      const runId = runRes.body.data.id;

      const entryRes = await request(app.getHttpServer())
        .get(`/api/v1/payroll/runs/${runId}/entries/${org.employeeId}`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);

      const entry = entryRes.body.data;
      expect(entry.incentiveAmount).toBe(totalAmount);
      // gross = basic(30000) + hra(10000) + incentive(1000)
      expect(entry.grossSalary).toBe(30000 + 10000 + totalAmount);

      const ledgerAfter = await request(app.getHttpServer())
        .get('/api/v1/incentive-ledger')
        .set(authed(org.approverToken, org.organizationId))
        .query({ payrollMonth, payrollYear })
        .expect(200);
      const ledgerRow = ledgerAfter.body.data.data.find((row: any) => row.id === ledgerId);
      expect(ledgerRow.isDeducted).toBe(true);
      expect(ledgerRow.payrollEntryId).toBe(entry.id);
    });
  });

  // ─── HOLD / RELEASE ───────────────────────────────────────────────────────

  describe('Hold/release path', () => {
    let org: OrgFixture;
    let ruleId: string;
    let ledgerId: string;
    let totalAmount: number;
    let payrollMonth: number;
    let payrollYear: number;
    const QUANTITY = 10;
    const RATE = 25;

    beforeAll(async () => {
      org = await createOrgFixture('hold-release');
      const rule = await createRule(org, RATE, 'hold-release');
      ruleId = rule.id;

      const now = new Date();
      payrollMonth = now.getMonth() + 1;
      payrollYear = now.getFullYear();
      totalAmount = QUANTITY * RATE;

      const todoId = await createSubmittedTodo(org, ruleId, QUANTITY);

      const approveRes = await request(app.getHttpServer())
        .put(`/api/v1/todos/${todoId}/approve`)
        .set(authed(org.approverToken, org.organizationId))
        .send({ approve: true, hold: true, payrollMonth, payrollYear })
        .expect(200);
      expect(approveRes.body.data.status).toBe('APPROVED');

      const ledgerRes = await request(app.getHttpServer())
        .get('/api/v1/incentive-ledger')
        .set(authed(org.approverToken, org.organizationId))
        .query({ payrollMonth, payrollYear })
        .expect(200);
      const ledgerRow = ledgerRes.body.data.data.find((row: any) => row.todo?.id === todoId);
      ledgerId = ledgerRow.id;

      expect(ledgerRow.isHeld).toBe(true);
      expect(ledgerRow.isReleased).toBe(false);
    });

    it('a payroll run for that month excludes the held incentive (contributes 0)', async () => {
      const runRes = await request(app.getHttpServer())
        .post('/api/v1/payroll/runs')
        .set(authed(org.approverToken, org.organizationId))
        .send({ month: payrollMonth, year: payrollYear, employeeIds: [org.employeeId] })
        .expect(201);
      const runId = runRes.body.data.id;

      const entryRes = await request(app.getHttpServer())
        .get(`/api/v1/payroll/runs/${runId}/entries/${org.employeeId}`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);

      expect(entryRes.body.data.incentiveAmount).toBe(0);
      expect(entryRes.body.data.grossSalary).toBe(30000 + 10000);
    });

    it('releasing the held entry then re-processing payroll includes it', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/incentive-ledger/${ledgerId}/release`)
        .set(authed(org.approverToken, org.organizationId))
        .send({ payrollMonth, payrollYear })
        .expect(200);

      const ledgerAfterRelease = await request(app.getHttpServer())
        .get('/api/v1/incentive-ledger')
        .set(authed(org.approverToken, org.organizationId))
        .query({ payrollMonth, payrollYear })
        .expect(200);
      const releasedRow = ledgerAfterRelease.body.data.data.find((row: any) => row.id === ledgerId);
      expect(releasedRow.isHeld).toBe(false);
      expect(releasedRow.isReleased).toBe(true);

      const runBefore = await request(app.getHttpServer())
        .get('/api/v1/payroll/runs')
        .set(authed(org.approverToken, org.organizationId))
        .query({ month: payrollMonth, year: payrollYear })
        .expect(200);
      const runId = runBefore.body.data.data.find(
        (run: any) => run.month === payrollMonth && run.year === payrollYear,
      ).id;

      const payrollService = app.get(PayrollService);
      await payrollService.processRun(org.organizationId, runId, [org.employeeId]);

      const entryRes = await request(app.getHttpServer())
        .get(`/api/v1/payroll/runs/${runId}/entries/${org.employeeId}`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);

      expect(entryRes.body.data.incentiveAmount).toBe(totalAmount);
      expect(entryRes.body.data.grossSalary).toBe(30000 + 10000 + totalAmount);

      const ledgerFinal = await request(app.getHttpServer())
        .get('/api/v1/incentive-ledger')
        .set(authed(org.approverToken, org.organizationId))
        .query({ payrollMonth, payrollYear })
        .expect(200);
      const finalRow = ledgerFinal.body.data.data.find((row: any) => row.id === ledgerId);
      expect(finalRow.isDeducted).toBe(true);
    });
  });

  // ─── IDEMPOTENCY RE-RUN ───────────────────────────────────────────────────

  describe('Idempotency re-run (critical, analogous to loans.e2e-spec.ts)', () => {
    let org: OrgFixture;
    let ruleId: string;
    let payrollMonth: number;
    let payrollYear: number;
    let totalAmount: number;
    const QUANTITY = 8;
    const RATE = 100;

    beforeAll(async () => {
      org = await createOrgFixture('idempotency');
      const rule = await createRule(org, RATE, 'idempotency');
      ruleId = rule.id;
      totalAmount = QUANTITY * RATE;

      const now = new Date();
      payrollMonth = now.getMonth() + 1;
      payrollYear = now.getFullYear();

      const todoId = await createSubmittedTodo(org, ruleId, QUANTITY);
      await request(app.getHttpServer())
        .put(`/api/v1/todos/${todoId}/approve`)
        .set(authed(org.approverToken, org.organizationId))
        .send({ approve: true, hold: false, payrollMonth, payrollYear })
        .expect(200);
    });

    it('first payroll run deducts the incentive exactly once', async () => {
      const runRes = await request(app.getHttpServer())
        .post('/api/v1/payroll/runs')
        .set(authed(org.approverToken, org.organizationId))
        .send({ month: payrollMonth, year: payrollYear, employeeIds: [org.employeeId] })
        .expect(201);
      const runId = runRes.body.data.id;

      const entryRes = await request(app.getHttpServer())
        .get(`/api/v1/payroll/runs/${runId}/entries/${org.employeeId}`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);
      expect(entryRes.body.data.incentiveAmount).toBe(totalAmount);
    });

    it('re-running processRun for the SAME period leaves incentiveAmount unchanged (not doubled, not reset)', async () => {
      const runBefore = await request(app.getHttpServer())
        .get('/api/v1/payroll/runs')
        .set(authed(org.approverToken, org.organizationId))
        .query({ month: payrollMonth, year: payrollYear })
        .expect(200);
      const runId = runBefore.body.data.data.find(
        (run: any) => run.month === payrollMonth && run.year === payrollYear,
      ).id;

      const entryBefore = await request(app.getHttpServer())
        .get(`/api/v1/payroll/runs/${runId}/entries/${org.employeeId}`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);
      const payrollEntryId = entryBefore.body.data.id;

      const payrollService = app.get(PayrollService);
      await payrollService.processRun(org.organizationId, runId, [org.employeeId]);

      const entryAfter = await request(app.getHttpServer())
        .get(`/api/v1/payroll/runs/${runId}/entries/${org.employeeId}`)
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);

      // Still totalAmount, NOT doubled and NOT reset to 0
      expect(entryAfter.body.data.incentiveAmount).toBe(totalAmount);
      expect(entryAfter.body.data.grossSalary).toBe(30000 + 10000 + totalAmount);

      const ledgerAfter = await request(app.getHttpServer())
        .get('/api/v1/incentive-ledger')
        .set(authed(org.approverToken, org.organizationId))
        .query({ payrollMonth, payrollYear })
        .expect(200);
      const ledgerRow = ledgerAfter.body.data.data.find(
        (row: any) => row.employee?.id === org.employeeId,
      );
      expect(ledgerRow.isDeducted).toBe(true);
      expect(ledgerRow.payrollEntryId).toBe(payrollEntryId);
    });
  });

  // ─── PERMISSION BOUNDARY ──────────────────────────────────────────────────

  describe('Permission boundary: todo:create-only user vs todo:approve', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('perm-boundary');
    });

    it('todo:create-only user cannot POST /incentive-rules (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/incentive-rules')
        .set(authed(org.employeeToken, org.organizationId))
        .send({ name: 'Should Fail', type: 'per_unit', rate: 10 })
        .expect(403);
    });

    it('todo:create-only user cannot PUT /todos/:id/approve (403)', async () => {
      const rule = await createRule(org, 10, 'perm-boundary');
      const todoId = await createSubmittedTodo(org, rule.id, 5);

      await request(app.getHttpServer())
        .put(`/api/v1/todos/${todoId}/approve`)
        .set(authed(org.employeeToken, org.organizationId))
        .send({ approve: true })
        .expect(403);
    });

    it('GET /todos for a non-approver returns only their own todos', async () => {
      // Approver creates a todo on behalf of themselves too (has todo:approve, counts as sees-all)
      const rule = await createRule(org, 10, 'perm-boundary-2');
      await request(app.getHttpServer())
        .post('/api/v1/todos')
        .set(authed(org.approverToken, org.organizationId))
        .send({ title: 'Approver own todo', incentiveRuleId: rule.id, quantity: 3, unit: 'units' })
        .expect(201);

      const employeeView = await request(app.getHttpServer())
        .get('/api/v1/todos')
        .set(authed(org.employeeToken, org.organizationId))
        .expect(200);

      expect(
        employeeView.body.data.data.every((todo: any) => todo.employeeId === org.employeeId),
      ).toBe(true);

      const approverView = await request(app.getHttpServer())
        .get('/api/v1/todos')
        .set(authed(org.approverToken, org.organizationId))
        .expect(200);
      // approver has todo:approve -> sees ALL todos in the org
      expect(approverView.body.data.data.length).toBeGreaterThanOrEqual(
        employeeView.body.data.data.length + 1,
      );
    });
  });
});
