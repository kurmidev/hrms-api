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
 * Disciplinary module (M16a) end-to-end coverage:
 *  - 5-memo threshold flags employee.flaggedForTerminationReview + returns
 *    terminationReviewTriggered, WITHOUT auto-changing employee.status.
 *  - The 4th memo does NOT trigger the flag.
 *  - Org-scoping: a memo created in org A is invisible (404) from org B.
 *  - Permission `exit:manage` enforced.
 */
describe('Disciplinary module (e2e)', () => {
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

      await prisma.disciplinaryMemo.deleteMany({ where: { organizationId } });
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
    const slug = `disciplinary-e2e-${label}-${uuid()}`;
    const org = await prisma.organization.create({
      data: { name: `Disciplinary E2E ${label}`, slug, isActive: true },
    });
    createdOrgIds.push(org.id);

    const adminRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `disciplinary-e2e-admin-${label}`,
        description: 'Test admin role',
        permissions: ['exit:manage'],
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
        phone: '9100000001',
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
        email: `admin-${label}@disciplinary-e2e.test`,
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
        phone: '9100000002',
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

  function issueMemo(org: OrgFixture, title: string) {
    return request(app.getHttpServer())
      .post('/api/v1/disciplinary')
      .set(authed(org.adminToken, org.organizationId))
      .send({
        employeeId: org.employeeId,
        type: 'WRITTEN_WARNING',
        title,
        reason: `Reason for ${title}`,
      });
  }

  describe('5-memo termination-review threshold', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('threshold');
    });

    it('the 4th active memo does NOT trigger the flag', async () => {
      let res;
      for (let i = 1; i <= 4; i++) {
        res = await issueMemo(org, `Memo ${i}`).expect(201);
      }
      expect(res!.body.data.terminationReviewTriggered).toBe(false);

      const employee = await prisma.employee.findUnique({ where: { id: org.employeeId } });
      expect(employee!.flaggedForTerminationReview).toBe(false);
      expect(employee!.status).toBe('ACTIVE');
    });

    it('the 5th active memo DOES trigger the flag, without changing employee status', async () => {
      const res = await issueMemo(org, 'Memo 5').expect(201);
      expect(res.body.data.terminationReviewTriggered).toBe(true);

      const employee = await prisma.employee.findUnique({ where: { id: org.employeeId } });
      expect(employee!.flaggedForTerminationReview).toBe(true);
      expect(employee!.terminationReviewFlaggedAt).not.toBeNull();
      // Flag + notify only — status must remain untouched (no auto-EXITED/SUSPENDED).
      expect(employee!.status).toBe('ACTIVE');
    });

    it('summary endpoint reflects the flagged state', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/disciplinary/employee/${org.employeeId}/summary`)
        .set(authed(org.adminToken, org.organizationId))
        .expect(200);

      expect(res.body.data.activeMemoCount).toBe(5);
      expect(res.body.data.threshold).toBe(5);
      expect(res.body.data.flaggedForTerminationReview).toBe(true);
    });
  });

  describe('Org-scoping', () => {
    let orgA: OrgFixture;
    let orgB: OrgFixture;
    let memoId: string;

    beforeAll(async () => {
      orgA = await createOrgFixture('scope-a');
      orgB = await createOrgFixture('scope-b');
      const res = await issueMemo(orgA, 'Cross-org memo').expect(201);
      memoId = res.body.data.id;
    });

    it('a memo created in org A is invisible (404) from org B', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/disciplinary/${memoId}`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .expect(404);
    });

    it('org B cannot see org A employee summary (employee not found)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/disciplinary/employee/${orgA.employeeId}/summary`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .expect(404);
    });

    it('list is org-scoped', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/disciplinary')
        .set(authed(orgB.adminToken, orgB.organizationId))
        .expect(200);
      expect(res.body.data.data.every((m: any) => m.organizationId === orgB.organizationId)).toBe(
        true,
      );
    });
  });

  describe('Permission enforcement', () => {
    it('rejects create without exit:manage permission', async () => {
      const org = await createOrgFixture('perm');

      const noPermRole = await prisma.role.create({
        data: {
          organizationId: org.organizationId,
          name: 'disciplinary-e2e-noperm',
          permissions: ['employee:read'],
          isSystemRole: false,
        },
      });
      const passwordHash = await bcrypt.hash(PASSWORD, 10);
      const department = await prisma.department.findFirstOrThrow({
        where: { organizationId: org.organizationId },
      });
      const designation = await prisma.designation.findFirstOrThrow({
        where: { organizationId: org.organizationId },
      });
      const structure = await prisma.payrollStructure.findFirstOrThrow({
        where: { organizationId: org.organizationId },
      });
      const emp = await prisma.employee.create({
        data: {
          organizationId: org.organizationId,
          empCode: 'NOPERM-1',
          firstName: 'No',
          lastName: 'Perm',
          phone: '9100000099',
          departmentId: department.id,
          designationId: designation.id,
          payrollStructureId: structure.id,
          status: 'ACTIVE',
        },
      });
      const user = await prisma.user.create({
        data: {
          organizationId: org.organizationId,
          employeeId: emp.id,
          email: 'noperm@disciplinary-e2e.test',
          passwordHash,
          isActive: true,
        },
      });
      await prisma.userRole.create({ data: { userId: user.id, roleId: noPermRole.id } });

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/disciplinary')
        .set(authed(login.body.data.accessToken, org.organizationId))
        .send({
          employeeId: org.employeeId,
          type: 'VERBAL_WARNING',
          title: 'Should be rejected',
          reason: 'no perm',
        })
        .expect(403);
    });
  });
});
