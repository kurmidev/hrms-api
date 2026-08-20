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
 * Response-envelope + organization-update contract coverage (M-perf-kpi plan,
 * "Performance KPI + API Response Format" workstream):
 *
 *  - Success envelope shape: { success: true, message, data, errorType: 'SUCCESS', httpCode }
 *  - Error envelope shape:   { success: false, message, error, errorType, httpCode }
 *  - PUT /organization accepts `website: ''` / `logoUrl: ''` (previously threw
 *    "must be a URL address" — see docs/known-issues.md), still validates a
 *    real (non-empty) invalid URL, and still accepts a real valid URL.
 *
 * Runs against the real dev MySQL/Redis instance (same as `npm run start:dev`).
 */
describe('Response envelope + organization update contract (e2e)', () => {
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
      await prisma.userRole.deleteMany({ where: { user: { organizationId } } });
      await prisma.loginHistory.deleteMany({ where: { user: { organizationId } } });
      await prisma.user.deleteMany({ where: { organizationId } });
      await prisma.role.deleteMany({ where: { organizationId } });
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
    await app.close();
  });

  interface OrgFixture {
    organizationId: string;
    adminToken: string;
  }

  async function createOrgFixture(label: string): Promise<OrgFixture> {
    const slug = `envelope-e2e-${label}-${uuid()}`;
    const org = await prisma.organization.create({
      data: { name: `Envelope E2E ${label}`, slug, isActive: true },
    });
    createdOrgIds.push(org.id);

    const adminRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `envelope-e2e-admin-${label}`,
        description: 'org:read + org:update only',
        permissions: ['org:read', 'org:update'],
        isSystemRole: false,
      },
    });

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `admin-${label}-${uuid()}@envelope-e2e.test`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: adminRole.id } });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    return { organizationId: org.id, adminToken: login.body.data.accessToken };
  }

  function authed(token: string, organizationId: string) {
    return {
      Authorization: `Bearer ${token}`,
      'X-Organization-ID': organizationId,
    };
  }

  // ─── Success envelope shape ──────────────────────────────────────────────

  describe('Success envelope shape', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('success-shape');
    });

    it('GET /organization returns { success, message, data, errorType, httpCode }', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/organization')
        .set(authed(org.adminToken, org.organizationId))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(org.organizationId);
      expect(res.body.errorType).toBe('SUCCESS');
      expect(res.body.httpCode).toBe(200);
    });
  });

  // ─── Error envelope shape ────────────────────────────────────────────────

  describe('Error envelope shape', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('error-shape');
    });

    it('a validation error (400) returns { success:false, message, error, errorType, httpCode }', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/organization')
        .set(authed(org.adminToken, org.organizationId))
        .send({ website: 'not-a-url-and-not-empty' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.error).toBeDefined();
      expect(res.body.error.statusCode).toBe(400);
      expect(res.body.error.path).toBe('/api/v1/organization');
      expect(res.body.error.method).toBe('PUT');
      expect(typeof res.body.errorType).toBe('string');
      expect(res.body.httpCode).toBe(400);
    });

    it('an unauthenticated request (401) uses the same failure envelope', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/organization').expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.httpCode).toBe(401);
    });

    it('a 404 (unknown route under /api/v1) uses the same failure envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/definitely-not-a-real-route')
        .set(authed(org.adminToken, org.organizationId))
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.httpCode).toBe(404);
    });
  });

  // ─── PUT /organization — website/logoUrl empty-string handling ──────────

  describe('PUT /organization — website/logoUrl accept empty string, reject bad URLs', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('url-fields');
    });

    it('accepts website: "" without throwing "must be a URL address"', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/organization')
        .set(authed(org.adminToken, org.organizationId))
        .send({ website: '' })
        .expect(200);
      expect(res.body.data.website).toBeNull();
    });

    it('accepts logoUrl: "" without throwing "must be a URL address"', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/organization')
        .set(authed(org.adminToken, org.organizationId))
        .send({ logoUrl: '' })
        .expect(200);
      expect(res.body.data.logoUrl).toBeNull();
    });

    it('accepts a valid website URL', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/organization')
        .set(authed(org.adminToken, org.organizationId))
        .send({ website: 'https://example.com' })
        .expect(200);
      expect(res.body.data.website).toBe('https://example.com');
    });

    it('accepts a valid logoUrl URL', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/organization')
        .set(authed(org.adminToken, org.organizationId))
        .send({ logoUrl: 'https://cdn.example.com/logo.png' })
        .expect(200);
      expect(res.body.data.logoUrl).toBe('https://cdn.example.com/logo.png');
    });

    it('rejects a clearly-invalid non-empty website URL (400)', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/organization')
        .set(authed(org.adminToken, org.organizationId))
        .send({ website: 'not-a-url' })
        .expect(400);
    });

    it('rejects a clearly-invalid non-empty logoUrl URL (400)', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/organization')
        .set(authed(org.adminToken, org.organizationId))
        .send({ logoUrl: 'not-a-url' })
        .expect(400);
    });
  });
});
