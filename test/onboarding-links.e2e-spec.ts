import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Onboarding fixes verification (e2e), covering onboarding-fixes.md #1–#4:
 *  #1 - Create still accepts departmentName/jobTitle as free-text strings
 *       (dropdowns are a frontend-only concern; DTO is unchanged).
 *  #2 - createLink/findLinks/findLinkById responses all include a non-null token.
 *  #3 - GET /onboarding-links/:id (the authenticated HR detail endpoint) returns
 *       the link detail for a valid id.
 *  #4 - POST /onboarding-links/:id/resend: allowed-status gate, token unchanged,
 *       BullMQ 'onboarding.invite' job re-enqueued, org-scoping.
 */
describe('Onboarding links (HR) — bug-fix verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let onboardingQueue: Queue;
  const createdOrgIds: string[] = [];

  const PASSWORD = 'Test@1234';

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
    onboardingQueue = app.get(getQueueToken('onboarding'));
  });

  afterAll(async () => {
    for (const organizationId of createdOrgIds) {
      await prisma.onboardingTransition.deleteMany({
        where: { onboardingLink: { organizationId } },
      });
      await prisma.onboardingLink.deleteMany({ where: { organizationId } });
      await prisma.userRole.deleteMany({ where: { user: { organizationId } } });
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
    hrToken: string;
  }

  async function createOrgFixture(label: string): Promise<OrgFixture> {
    const slug = `onboarding-links-e2e-${label}-${uuid()}`;
    const org = await prisma.organization.create({
      data: { name: `Onboarding Links E2E ${label}`, slug, isActive: true },
    });
    createdOrgIds.push(org.id);

    // Mirrors seed.ts hr_manager: employee:read/create/update + onboarding:manage.
    const hrRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `onboarding-e2e-hr-${label}`,
        permissions: ['employee:read', 'employee:create', 'employee:update', 'employee:delete'],
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
    const hrEmployee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        empCode: `HR-${label}`,
        firstName: 'HR',
        lastName: label,
        phone: '9300000001',
        departmentId: department.id,
        designationId: designation.id,
        status: 'ACTIVE',
      },
    });
    const hrUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        employeeId: hrEmployee.id,
        email: `hr-${label}@onboarding-links-e2e.test`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: hrUser.id, roleId: hrRole.id } });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: hrUser.email, password: PASSWORD })
      .expect(200);

    return { organizationId: org.id, hrToken: login.body.data.accessToken };
  }

  function authed(org: OrgFixture) {
    return {
      Authorization: `Bearer ${org.hrToken}`,
      'X-Organization-ID': org.organizationId,
    };
  }

  const inviteBody = (overrides: Record<string, unknown> = {}) => ({
    email: `candidate-${uuid()}@example.com`,
    phone: '9876543210',
    candidateName: 'Priya Sharma',
    jobTitle: 'Rig Operator',
    departmentName: 'Operations',
    workLocation: 'Mumbai Offshore',
    ...overrides,
  });

  describe('#1 — create accepts departmentName/jobTitle as free-text name strings', () => {
    it('POST /onboarding-links succeeds with plain name strings', async () => {
      const org = await createOrgFixture('create-1');
      const res = await request(app.getHttpServer())
        .post('/api/v1/onboarding-links')
        .set(authed(org))
        .send(inviteBody())
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.departmentName).toBe('Operations');
      expect(res.body.data.jobTitle).toBe('Rig Operator');
    });
  });

  describe('#2 — token is present in create/list/detail responses', () => {
    it('create response includes a non-null token', async () => {
      const org = await createOrgFixture('token-create');
      const res = await request(app.getHttpServer())
        .post('/api/v1/onboarding-links')
        .set(authed(org))
        .send(inviteBody())
        .expect(201);

      expect(res.body.data.token).toBeTruthy();
      expect(typeof res.body.data.token).toBe('string');
    });

    it('list response includes token per row', async () => {
      const org = await createOrgFixture('token-list');
      await request(app.getHttpServer())
        .post('/api/v1/onboarding-links')
        .set(authed(org))
        .send(inviteBody())
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/onboarding-links')
        .set(authed(org))
        .expect(200);

      // paginate() wraps the array as { data, meta } under the envelope's data field.
      const rows = res.body.data.data;
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.token).toBeTruthy();
      }
    });

    it('detail response includes token', async () => {
      const org = await createOrgFixture('token-detail');
      const created = await request(app.getHttpServer())
        .post('/api/v1/onboarding-links')
        .set(authed(org))
        .send(inviteBody())
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/onboarding-links/${created.body.data.id}`)
        .set(authed(org))
        .expect(200);

      expect(res.body.data.token).toBe(created.body.data.token);
    });
  });

  describe('#3 — GET /onboarding-links/:id is the authenticated HR detail endpoint', () => {
    it('returns link detail (with transitions) for a valid id, org-scoped', async () => {
      const org = await createOrgFixture('detail-3');
      const created = await request(app.getHttpServer())
        .post('/api/v1/onboarding-links')
        .set(authed(org))
        .send(inviteBody())
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/onboarding-links/${created.body.data.id}`)
        .set(authed(org))
        .expect(200);

      expect(res.body.data.id).toBe(created.body.data.id);
      expect(res.body.data.status).toBe('PENDING');
      expect(Array.isArray(res.body.data.transitions)).toBe(true);
    });

    it('404s for an id from another organization (org scoping)', async () => {
      const orgA = await createOrgFixture('detail-scope-a');
      const orgB = await createOrgFixture('detail-scope-b');
      const created = await request(app.getHttpServer())
        .post('/api/v1/onboarding-links')
        .set(authed(orgA))
        .send(inviteBody())
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/v1/onboarding-links/${created.body.data.id}`)
        .set(authed(orgB))
        .expect(404);
    });
  });

  describe('#4 — resend endpoint', () => {
    it('resends for a PENDING link: 200, same token, re-enqueues onboarding.invite', async () => {
      const org = await createOrgFixture('resend-pending');
      const created = await request(app.getHttpServer())
        .post('/api/v1/onboarding-links')
        .set(authed(org))
        .send(inviteBody())
        .expect(201);

      const addSpy = jest.spyOn(onboardingQueue, 'add');
      const callsBefore = addSpy.mock.calls.length;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/onboarding-links/${created.body.data.id}/resend`)
        .set(authed(org))
        .expect(200);

      expect(res.body.data.token).toBe(created.body.data.token);

      const newCalls = addSpy.mock.calls.slice(callsBefore);
      const inviteCall = newCalls.find(([jobName]) => jobName === 'onboarding.invite');
      expect(inviteCall).toBeTruthy();
      expect(inviteCall?.[1]).toMatchObject({ token: created.body.data.token });

      addSpy.mockRestore();
    });

    it('rejects resend for ACTIVATED-equivalent terminal status with 400', async () => {
      const org = await createOrgFixture('resend-terminal');
      const created = await request(app.getHttpServer())
        .post('/api/v1/onboarding-links')
        .set(authed(org))
        .send(inviteBody())
        .expect(201);

      // Force the link into a non-resendable status directly (REJECTED is
      // reachable without a full activation flow / employee setup).
      await prisma.onboardingLink.update({
        where: { id: created.body.data.id },
        data: { status: 'REJECTED' },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/onboarding-links/${created.body.data.id}/resend`)
        .set(authed(org))
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('rejects resend for EXPIRED status with 400', async () => {
      const org = await createOrgFixture('resend-expired');
      const created = await request(app.getHttpServer())
        .post('/api/v1/onboarding-links')
        .set(authed(org))
        .send(inviteBody())
        .expect(201);

      await prisma.onboardingLink.update({
        where: { id: created.body.data.id },
        data: { status: 'EXPIRED' },
      });

      await request(app.getHttpServer())
        .post(`/api/v1/onboarding-links/${created.body.data.id}/resend`)
        .set(authed(org))
        .expect(400);
    });

    it('extends expiresAt by 7 days when resending an already-expired-window link', async () => {
      const org = await createOrgFixture('resend-extend');
      const created = await request(app.getHttpServer())
        .post('/api/v1/onboarding-links')
        .set(authed(org))
        .send(inviteBody())
        .expect(201);

      const pastExpiry = new Date();
      pastExpiry.setDate(pastExpiry.getDate() - 1);
      await prisma.onboardingLink.update({
        where: { id: created.body.data.id },
        data: { expiresAt: pastExpiry },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/onboarding-links/${created.body.data.id}/resend`)
        .set(authed(org))
        .expect(200);

      expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(res.body.data.token).toBe(created.body.data.token);
    });

    it('resend is org-scoped: an org B token cannot resend org A link (404)', async () => {
      const orgA = await createOrgFixture('resend-scope-a');
      const orgB = await createOrgFixture('resend-scope-b');
      const created = await request(app.getHttpServer())
        .post('/api/v1/onboarding-links')
        .set(authed(orgA))
        .send(inviteBody())
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/onboarding-links/${created.body.data.id}/resend`)
        .set(authed(orgB))
        .expect(404);
    });
  });
});
