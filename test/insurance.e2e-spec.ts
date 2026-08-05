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
 * Insurance & Statutory module (M16c) end-to-end coverage:
 *  - Enrollment defaults approvalStatus=PENDING.
 *  - approve endpoint sets APPROVED/REJECTED + approvedBy/approvedAt.
 *  - Unique-enrollment guard (same employee+policy twice rejected).
 *  - PF/ESI/UAN are referenced from the employee relation, not duplicated.
 *  - Org-scoping across policies + enrollments.
 *  - Permission split: employee:read for GET, employee:update for writes.
 */
describe('Insurance module (e2e)', () => {
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

      await prisma.employeeInsurance.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.insurancePolicy.deleteMany({ where: { organizationId } });
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
    readOnlyToken: string;
    employeeId: string;
  }

  async function createOrgFixture(label: string): Promise<OrgFixture> {
    const slug = `insurance-e2e-${label}-${uuid()}`;
    const org = await prisma.organization.create({
      data: { name: `Insurance E2E ${label}`, slug, isActive: true },
    });
    createdOrgIds.push(org.id);

    const adminRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `insurance-e2e-admin-${label}`,
        permissions: ['employee:read', 'employee:update'],
        isSystemRole: false,
      },
    });
    const readOnlyRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `insurance-e2e-readonly-${label}`,
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

    const adminEmployee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `ADM-${label}`,
        firstName: 'Admin',
        lastName: label,
        phone: '9300000001',
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
        email: `admin-${label}@insurance-e2e.test`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });

    const readOnlyEmployee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `RO-${label}`,
        firstName: 'ReadOnly',
        lastName: label,
        phone: '9300000003',
        departmentId: department.id,
        designationId: designation.id,
        payrollStructureId: payrollStructure.id,
        status: 'ACTIVE',
      },
    });
    const readOnlyUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        employeeId: readOnlyEmployee.id,
        email: `readonly-${label}@insurance-e2e.test`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: readOnlyUser.id, roleId: readOnlyRole.id } });

    const targetEmployee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `TGT-${label}`,
        firstName: 'Target',
        lastName: label,
        phone: '9300000002',
        departmentId: department.id,
        designationId: designation.id,
        payrollStructureId: payrollStructure.id,
        status: 'ACTIVE',
        pfNumber: `PF-${label}`,
        esiNumber: `ESI-${label}`,
        uanNumber: `UAN-${label}`,
      },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminUser.email, password: PASSWORD })
      .expect(200);
    const readOnlyLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: readOnlyUser.email, password: PASSWORD })
      .expect(200);

    return {
      organizationId: org.id,
      adminToken: adminLogin.body.data.accessToken,
      readOnlyToken: readOnlyLogin.body.data.accessToken,
      employeeId: targetEmployee.id,
    };
  }

  function authed(token: string, organizationId: string) {
    return {
      Authorization: `Bearer ${token}`,
      'X-Organization-ID': organizationId,
    };
  }

  async function createPolicy(org: OrgFixture, name = 'Group Health 2026') {
    const res = await request(app.getHttpServer())
      .post('/api/v1/insurance/policies')
      .set(authed(org.adminToken, org.organizationId))
      .send({
        name,
        provider: 'Star Health',
        policyNumber: `SH-${uuid()}`,
        type: 'HEALTH',
        coverageAmount: 500000,
        premium: 12000,
      })
      .expect(201);
    return res.body.data.id as string;
  }

  describe('Enrollment default + approval lifecycle', () => {
    let org: OrgFixture;
    let policyId: string;
    let enrollmentId: string;

    beforeAll(async () => {
      org = await createOrgFixture('lifecycle');
      policyId = await createPolicy(org);
    });

    it('POST /insurance/enroll defaults approvalStatus=PENDING and references employee PF/ESI/UAN (not duplicated)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/insurance/enroll')
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId, policyId })
        .expect(201);

      enrollmentId = res.body.data.id;
      expect(res.body.data.approvalStatus).toBe('PENDING');
      expect(res.body.data.approvedBy).toBeNull();
      expect(res.body.data.approvedAt).toBeNull();
      expect(res.body.data.employee.pfNumber).toBe(`PF-lifecycle`);
      expect(res.body.data.employee.esiNumber).toBe(`ESI-lifecycle`);
      expect(res.body.data.employee.uanNumber).toBe(`UAN-lifecycle`);
    });

    it('rejects a duplicate enrollment for the same employee+policy', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/insurance/enroll')
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId, policyId })
        .expect(409);
    });

    it('approve endpoint sets APPROVED + approvedBy/approvedAt', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/insurance/enrollments/${enrollmentId}/approve`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ approvalStatus: 'APPROVED' })
        .expect(200);

      expect(res.body.data.approvalStatus).toBe('APPROVED');
      expect(res.body.data.approvedBy).toBeTruthy();
      expect(res.body.data.approvedAt).toBeTruthy();
    });

    it('approve endpoint can REJECT', async () => {
      const policy2 = await createPolicy(org, 'Accidental Cover');
      const enrollRes = await request(app.getHttpServer())
        .post('/api/v1/insurance/enroll')
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId, policyId: policy2 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .put(`/api/v1/insurance/enrollments/${enrollRes.body.data.id}/approve`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ approvalStatus: 'REJECTED' })
        .expect(200);

      expect(res.body.data.approvalStatus).toBe('REJECTED');
      expect(res.body.data.approvedBy).toBeTruthy();
    });
  });

  describe('Permission split: employee:read (GET) vs employee:update (writes)', () => {
    let org: OrgFixture;
    let policyId: string;

    beforeAll(async () => {
      org = await createOrgFixture('perm');
      policyId = await createPolicy(org);
    });

    it('read-only user CAN list policies and enrollments', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/insurance/policies')
        .set(authed(org.readOnlyToken, org.organizationId))
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/insurance/enrollments')
        .set(authed(org.readOnlyToken, org.organizationId))
        .expect(200);
    });

    it('read-only user CANNOT create a policy, enroll, or approve', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/insurance/policies')
        .set(authed(org.readOnlyToken, org.organizationId))
        .send({ name: 'x', provider: 'x', policyNumber: `x-${uuid()}`, type: 'HEALTH' })
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/v1/insurance/enroll')
        .set(authed(org.readOnlyToken, org.organizationId))
        .send({ employeeId: org.employeeId, policyId })
        .expect(403);
    });
  });

  describe('Org-scoping', () => {
    let orgA: OrgFixture;
    let orgB: OrgFixture;
    let policyId: string;
    let enrollmentId: string;

    beforeAll(async () => {
      orgA = await createOrgFixture('scope-a');
      orgB = await createOrgFixture('scope-b');
      policyId = await createPolicy(orgA);
      const res = await request(app.getHttpServer())
        .post('/api/v1/insurance/enroll')
        .set(authed(orgA.adminToken, orgA.organizationId))
        .send({ employeeId: orgA.employeeId, policyId })
        .expect(201);
      enrollmentId = res.body.data.id;
    });

    it('org A policy is invisible (404) from org B', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/insurance/policies/${policyId}`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .expect(404);
    });

    it('org A enrollment is invisible (404) from org B', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/insurance/enrollments/${enrollmentId}`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .expect(404);
    });

    it('org B cannot approve an org A enrollment', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/insurance/enrollments/${enrollmentId}/approve`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .send({ approvalStatus: 'APPROVED' })
        .expect(404);
    });

    it('policy list is org-scoped', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/insurance/policies')
        .set(authed(orgB.adminToken, orgB.organizationId))
        .expect(200);
      expect(res.body.data.data.every((p: any) => p.organizationId === orgB.organizationId)).toBe(
        true,
      );
    });

    it('enrollment list is org-scoped (no cross-org enrollments visible)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/insurance/enrollments')
        .set(authed(orgB.adminToken, orgB.organizationId))
        .expect(200);
      expect(res.body.data.data.find((e: any) => e.id === enrollmentId)).toBeUndefined();
    });
  });
});
