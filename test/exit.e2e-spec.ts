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
 * Exit module (M16b) end-to-end coverage:
 *  - Asset-handover blocks clearance completion until every AssetAssignment
 *    is both returnedAt-set AND recoveredAtExit=true.
 *  - Settlement is blocked until status=CLEARED.
 *  - Settlement summary references (not recomputes) the Loans outstanding
 *    balance + unreturned asset count.
 *  - Access deactivation on successful settle: employee -> EXITED.
 *  - Org-scoping: an exit record created in org A is invisible (404) from org B.
 */
describe('Exit module (e2e)', () => {
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

      await prisma.exitRecord.deleteMany({ where: { organizationId } });
      await prisma.assetAssignment.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.asset.deleteMany({ where: { organizationId } });
      await prisma.loanEmiSchedule.deleteMany({
        where: { loan: { employeeId: { in: employeeIds } } },
      });
      await prisma.loanApplication.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.userRole.deleteMany({ where: { user: { organizationId } } });
      await prisma.loginHistory.deleteMany({ where: { user: { organizationId } } });
      await prisma.user.deleteMany({ where: { organizationId } });
      await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
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
    adminToken: string;
    employeeId: string;
  }

  async function createOrgFixture(label: string): Promise<OrgFixture> {
    const slug = `exit-e2e-${label}-${uuid()}`;
    const org = await prisma.organization.create({
      data: { name: `Exit E2E ${label}`, slug, isActive: true },
    });
    createdOrgIds.push(org.id);

    const adminRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `exit-e2e-admin-${label}`,
        permissions: [
          'exit:manage',
          'asset:assign',
          'asset:return',
          'loan:approve',
          'loan:apply',
          'loan:read',
        ],
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

    const adminEmployee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `ADM-${label}`,
        firstName: 'Admin',
        lastName: label,
        phone: '9200000001',
        departmentId: department.id,
        designationId: designation.id,
        payrollStructureId: payrollStructure.id,
        status: 'ACTIVE',
      },
    });
    const adminUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        employeeId: adminEmployee.id,
        email: `admin-${label}@exit-e2e.test`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });

    const targetEmployee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `TGT-${label}`,
        firstName: 'Target',
        lastName: label,
        phone: '9200000002',
        departmentId: department.id,
        designationId: designation.id,
        payrollStructureId: payrollStructure.id,
        status: 'ACTIVE',
      },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminUser.email, password: PASSWORD })
      .expect(200);

    return {
      organizationId: org.id,
      adminToken: adminLogin.body.data.accessToken,
      employeeId: targetEmployee.id,
    };
  }

  function authed(token: string, organizationId: string) {
    return {
      Authorization: `Bearer ${token}`,
      'X-Organization-ID': organizationId,
    };
  }

  async function initiateExit(org: OrgFixture) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/exit')
      .set(authed(org.adminToken, org.organizationId))
      .send({
        employeeId: org.employeeId,
        type: 'RESIGNATION',
        initiatedBy: 'SELF',
        reason: 'Personal reasons',
      })
      .expect(201);
    return res.body.data.id as string;
  }

  async function clearAllDepartments(org: OrgFixture, exitId: string, advance = true) {
    const departments = await prisma.department.findMany({
      where: { organizationId: org.organizationId },
      select: { name: true },
    });
    const res = await request(app.getHttpServer())
      .put(`/api/v1/exit/${exitId}/clearance`)
      .set(authed(org.adminToken, org.organizationId))
      .send({
        departments: departments.map((d) => ({ department: d.name, cleared: true })),
        knowledgeTransferComplete: true,
        advanceToClearedIfComplete: advance,
      })
      .expect(200);
    return res;
  }

  describe('Rule: asset handover blocks clearance completion', () => {
    let org: OrgFixture;
    let exitId: string;
    let assetId: string;

    beforeAll(async () => {
      org = await createOrgFixture('assets');
      exitId = await initiateExit(org);

      const assetRes = await request(app.getHttpServer())
        .post('/api/v1/assets')
        .set(authed(org.adminToken, org.organizationId))
        .send({ type: 'Laptop', name: 'Dell Latitude', serialNumber: `SN-${uuid()}` })
        .expect(201);
      assetId = assetRes.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/v1/assets/${assetId}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId })
        .expect(201);
    });

    it('rejects transition to CLEARED while an asset is unreturned', async () => {
      const res = await clearAllDepartments(org, exitId);
      expect(res.body.data.status).not.toBe('CLEARED');
      expect(res.body.data.clearanceStatus.assetHandover.unreturnedCount).toBe(1);
      expect(res.body.data.clearanceStatus.assetHandover.cleared).toBe(false);
    });

    it('succeeds once the asset is returned (recoveredAtExit set true by return())', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/assets/${assetId}/return`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ conditionOnReturn: 'Good' })
        .expect(200);

      const res = await clearAllDepartments(org, exitId);
      expect(res.body.data.clearanceStatus.assetHandover.unreturnedCount).toBe(0);
      expect(res.body.data.clearanceStatus.assetHandover.cleared).toBe(true);
      expect(res.body.data.status).toBe('CLEARED');
    });
  });

  describe('Rule: settlement blocked until CLEARED + references Loans outstanding balance', () => {
    let org: OrgFixture;
    let exitId: string;

    beforeAll(async () => {
      org = await createOrgFixture('settle');
      exitId = await initiateExit(org);
    });

    it('settle is rejected while status is not CLEARED', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/exit/${exitId}/settle`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ settlementAmount: 10000 })
        .expect(400);
    });

    it('settle succeeds once CLEARED, referencing Loans outstanding balance (not recomputed) + unreturned asset count, and deactivates employee to EXITED', async () => {
      // Create + approve a loan so there's a real outstanding balance to reference.
      const loanRes = await request(app.getHttpServer())
        .post('/api/v1/loans')
        .set(authed(org.adminToken, org.organizationId))
        .send({ amountRequested: 12000, tenureMonths: 12, employeeId: org.employeeId })
        .expect(201);
      const loanId = loanRes.body.data.id;

      await request(app.getHttpServer())
        .put(`/api/v1/loans/${loanId}/approve`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ interestRate: 0 })
        .expect(200);

      await clearAllDepartments(org, exitId);

      const settleRes = await request(app.getHttpServer())
        .put(`/api/v1/exit/${exitId}/settle`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ settlementAmount: 25000 })
        .expect(200);

      expect(settleRes.body.data.exitRecord.status).toBe('SETTLED');
      expect(settleRes.body.data.unreturnedAssetCount).toBe(0);
      // 12000 principal / 12 months, 0% interest => ~1000 outstanding on first EMI due;
      // key assertion is that the field is present, numeric, and sourced from Loans
      // (i.e. it is NOT simply echoing settlementAmount or undefined/null).
      expect(typeof settleRes.body.data.outstandingLoanBalance).toBe('number');
      expect(settleRes.body.data.outstandingLoanBalance).toBeGreaterThan(0);
      expect(settleRes.body.data.outstandingLoanBalance).not.toBe(
        settleRes.body.data.settlementAmount,
      );

      const employee = await prisma.employee.findUnique({ where: { id: org.employeeId } });
      expect(employee!.status).toBe('EXITED');
    });
  });

  describe('Org-scoping', () => {
    let orgA: OrgFixture;
    let orgB: OrgFixture;
    let exitId: string;

    beforeAll(async () => {
      orgA = await createOrgFixture('scope-a');
      orgB = await createOrgFixture('scope-b');
      exitId = await initiateExit(orgA);
    });

    it('an exit record created in org A is invisible (404) from org B', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/exit/${exitId}`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .expect(404);
    });

    it('org B cannot update clearance on an org A exit record', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/exit/${exitId}/clearance`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .send({ knowledgeTransferComplete: true })
        .expect(404);
    });

    it('org B cannot settle an org A exit record', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/exit/${exitId}/settle`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .send({ settlementAmount: 1000 })
        .expect(404);
    });

    it('list is org-scoped', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/exit')
        .set(authed(orgB.adminToken, orgB.organizationId))
        .expect(200);
      expect(res.body.data.data.every((r: any) => r.organizationId === orgB.organizationId)).toBe(
        true,
      );
    });
  });
});
