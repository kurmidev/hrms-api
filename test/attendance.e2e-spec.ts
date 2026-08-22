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
 * Attendance correction maker-checker regression (hrms-backend.md §26):
 *  - An employee who requested a correction and ALSO holds `attendance:correct`
 *    must still be blocked (403) from approving their OWN correction request.
 *  - A DIFFERENT user holding `attendance:correct` must still be able to
 *    approve normally — the guard blocks only self-approval.
 *
 * Runs against the real dev MySQL/Redis instance (same as `npm run start:dev`).
 */
describe('Attendance module — maker-checker self-approval guard (e2e)', () => {
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

      await prisma.attendanceLog.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.userRole.deleteMany({ where: { user: { organizationId } } });
      await prisma.loginHistory.deleteMany({ where: { user: { organizationId } } });
      await prisma.user.deleteMany({ where: { organizationId } });
      await prisma.employee.deleteMany({ where: { organizationId } });
      await prisma.designation.deleteMany({ where: { organizationId } });
      await prisma.department.deleteMany({ where: { organizationId } });
      await prisma.role.deleteMany({ where: { organizationId } });
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
    await app.close();
  });

  interface OrgFixture {
    organizationId: string;
    approverToken: string;
    requesterUserId: string;
    requesterEmail: string;
    requesterId: string;
    requesterToken: string;
  }

  async function createOrgFixture(label: string): Promise<OrgFixture> {
    const slug = `attendance-e2e-${label}-${uuid()}`;
    const org = await prisma.organization.create({
      data: { name: `Attendance E2E ${label}`, slug, isActive: true },
    });
    createdOrgIds.push(org.id);

    const approverRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `attendance-e2e-approver-${label}`,
        description: 'Test approver role',
        permissions: ['attendance:checkin', 'attendance:read', 'attendance:correct'],
        isSystemRole: false,
      },
    });

    const requesterRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `attendance-e2e-requester-${label}`,
        description: 'Test requester role',
        permissions: ['attendance:checkin', 'attendance:read'],
        isSystemRole: false,
      },
    });

    const department = await prisma.department.create({
      data: { organizationId: org.id, name: `Dept ${label}` },
    });
    const designation = await prisma.designation.create({
      data: { organizationId: org.id, departmentId: department.id, name: `Designation ${label}` },
    });

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const approverEmployee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `APR-${label}`,
        firstName: 'Approver',
        lastName: label,
        phone: '9400000001',
        departmentId: department.id,
        designationId: designation.id,
        status: 'ACTIVE',
      },
    });
    const approverUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        employeeId: approverEmployee.id,
        email: `approver-${label}@attendance-e2e.test`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: approverUser.id, roleId: approverRole.id } });

    const requester = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `REQ-${label}`,
        firstName: 'Requester',
        lastName: label,
        phone: '9400000002',
        departmentId: department.id,
        designationId: designation.id,
        status: 'ACTIVE',
      },
    });
    const requesterEmail = `requester-${label}@attendance-e2e.test`;
    const requesterUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        employeeId: requester.id,
        email: requesterEmail,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: requesterUser.id, roleId: requesterRole.id } });

    const approverLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: approverUser.email, password: PASSWORD })
      .expect(200);
    const requesterLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: requesterEmail, password: PASSWORD })
      .expect(200);

    return {
      organizationId: org.id,
      approverToken: approverLogin.body.data.accessToken,
      requesterUserId: requesterUser.id,
      requesterEmail,
      requesterId: requester.id,
      requesterToken: requesterLogin.body.data.accessToken,
    };
  }

  function authed(token: string, organizationId: string) {
    return {
      Authorization: `Bearer ${token}`,
      'X-Organization-ID': organizationId,
    };
  }

  async function requestCorrection(org: OrgFixture, date: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/attendance/correction-request')
      .set(authed(org.requesterToken, org.organizationId))
      .send({ date, reason: 'Forgot to check in, was on client site' })
      .expect(201);
    return res.body.data.id as string;
  }

  describe('Maker-checker: self-approval guard', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('self-approval');

      // Grant the requester's own user attendance:correct too, then re-login
      // to pick up the newly-flattened permission in the JWT.
      const approverRole = await prisma.role.findFirstOrThrow({
        where: {
          organizationId: org.organizationId,
          name: 'attendance-e2e-approver-self-approval',
        },
      });
      await prisma.userRole.create({
        data: { userId: org.requesterUserId, roleId: approverRole.id },
      });
      const relogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: org.requesterEmail, password: PASSWORD })
        .expect(200);
      org = { ...org, requesterToken: relogin.body.data.accessToken };
    });

    it('the requester, even holding attendance:correct, gets 403 approving their own correction request', async () => {
      const id = await requestCorrection(org, '2026-07-08');

      const res = await request(app.getHttpServer())
        .put(`/api/v1/attendance/correction/${id}/approve`)
        .set(authed(org.requesterToken, org.organizationId))
        .send({ notes: 'Self approve attempt' })
        .expect(403);
      expect(res.body.message).toMatch(/own/i);
    });

    it('a DIFFERENT user holding attendance:correct can approve the same correction request normally', async () => {
      const id = await requestCorrection(org, '2026-07-09');

      const res = await request(app.getHttpServer())
        .put(`/api/v1/attendance/correction/${id}/approve`)
        .set(authed(org.approverToken, org.organizationId))
        .send({ notes: 'Approved by a different user' })
        .expect(200);
      expect(res.body.success).toBe(true);
    });
  });
});
