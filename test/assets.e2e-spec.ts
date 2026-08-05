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
 * Assets module (M15b) end-to-end coverage:
 *  - Assign workflow: requires AVAILABLE, sets ASSIGNED + creates an open assignment;
 *    assigning an already-ASSIGNED asset is rejected.
 *  - Return workflow: closes the latest open assignment (returnedAt + conditionOnReturn),
 *    resets asset status.
 *  - Assignment history accumulation: assign->return->re-assign produces TWO assignment
 *    rows, never overwrites the first (rule §10).
 *  - Org-scoping on assets AND assignments (transitively via asset.organizationId):
 *    cross-org get/assign/return/history all 404.
 *  - recoveredAtExit defaults to false on new assignments.
 *
 * Runs against the real dev MySQL/Redis instance (same as `npm run start:dev`).
 */
describe('Assets module (e2e)', () => {
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
      const assets = await prisma.asset.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const assetIds = assets.map((a) => a.id);

      await prisma.assetAssignment.deleteMany({ where: { assetId: { in: assetIds } } });
      await prisma.asset.deleteMany({ where: { organizationId } });
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
    adminToken: string;
    readOnlyToken: string;
    employeeId: string;
    otherEmployeeId: string;
  }

  async function createOrgFixture(label: string): Promise<OrgFixture> {
    const slug = `assets-e2e-${label}-${uuid()}`;
    const org = await prisma.organization.create({
      data: { name: `Assets E2E ${label}`, slug, isActive: true },
    });
    createdOrgIds.push(org.id);

    const adminRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `assets-e2e-admin-${label}`,
        description: 'Full asset access',
        permissions: ['asset:read', 'asset:assign', 'asset:return'],
        isSystemRole: false,
      },
    });

    const readOnlyRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `assets-e2e-readonly-${label}`,
        description: 'Read-only asset access',
        permissions: ['asset:read'],
        isSystemRole: false,
      },
    });

    const dept = await prisma.department.create({
      data: { organizationId: org.id, name: `Dept ${label}` },
    });
    const designation = await prisma.designation.create({
      data: { organizationId: org.id, departmentId: dept.id, name: `Designation ${label}` },
    });

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    async function makeUser(empCode: string, roleId: string) {
      const employee = await prisma.employee.create({
        data: {
          organizationId: org.id,
          empCode,
          firstName: empCode,
          lastName: label,
          phone: `9${Date.now() % 1000000000}`,
          departmentId: dept.id,
          designationId: designation.id,
          status: 'ACTIVE',
        },
      });
      const user = await prisma.user.create({
        data: {
          organizationId: org.id,
          employeeId: employee.id,
          email: `${empCode.toLowerCase()}-${label}-${uuid().slice(0, 6)}@assets-e2e.test`,
          passwordHash,
          isActive: true,
        },
      });
      await prisma.userRole.create({ data: { userId: user.id, roleId } });
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(200);
      return {
        employeeId: employee.id,
        userId: user.id,
        token: login.body.data.accessToken as string,
      };
    }

    const admin = await makeUser('ADMIN', adminRole.id);
    const readOnly = await makeUser('VIEWER', readOnlyRole.id);
    const target = await makeUser('TARGET', readOnlyRole.id);
    const target2 = await makeUser('TARGET2', readOnlyRole.id);

    return {
      organizationId: org.id,
      adminToken: admin.token,
      readOnlyToken: readOnly.token,
      employeeId: target.employeeId,
      otherEmployeeId: target2.employeeId,
    };
  }

  function authed(token: string, organizationId: string) {
    return {
      Authorization: `Bearer ${token}`,
      'X-Organization-ID': organizationId,
    };
  }

  async function createAsset(org: OrgFixture, overrides: Record<string, unknown> = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/assets')
      .set(authed(org.adminToken, org.organizationId))
      .send({
        type: 'LAPTOP',
        name: `Dell Latitude ${uuid().slice(0, 6)}`,
        serialNumber: `SN-${uuid().slice(0, 8)}`,
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  // ─── Assign workflow ─────────────────────────────────────────────────────

  describe('Assign workflow', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('assign');
    });

    it('assigns an AVAILABLE asset: sets ASSIGNED + creates an open assignment', async () => {
      const asset = await createAsset(org);
      expect(asset.status).toBe('AVAILABLE');

      const assigned = await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId, conditionOnIssue: 'Good condition' })
        .expect(201);
      expect(assigned.body.data.status).toBe('ASSIGNED');

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/assets/${asset.id}`)
        .set(authed(org.adminToken, org.organizationId))
        .expect(200);
      expect(detail.body.data.assignments).toHaveLength(1);
      expect(detail.body.data.assignments[0].returnedAt).toBeNull();
      expect(detail.body.data.assignments[0].employeeId).toBe(org.employeeId);
      expect(detail.body.data.assignments[0].conditionOnIssue).toBe('Good condition');
    });

    it('rejects assigning an already-ASSIGNED asset', async () => {
      const asset = await createAsset(org);
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.otherEmployeeId })
        .expect(400);
    });

    it('recoveredAtExit defaults to false on a new assignment', async () => {
      const asset = await createAsset(org);
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId })
        .expect(201);

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/assets/${asset.id}`)
        .set(authed(org.adminToken, org.organizationId))
        .expect(200);
      expect(detail.body.data.assignments[0].recoveredAtExit).toBe(false);
      expect(detail.body.data.assignments[0].recoveryNotes).toBeNull();
    });

    it('a read-only (asset:read only) user gets 403 assigning', async () => {
      const asset = await createAsset(org);
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(org.readOnlyToken, org.organizationId))
        .send({ employeeId: org.employeeId })
        .expect(403);
    });
  });

  // ─── Return workflow ─────────────────────────────────────────────────────

  describe('Return workflow', () => {
    let org: OrgFixture;

    beforeAll(async () => {
      org = await createOrgFixture('return');
    });

    it('closes the latest open assignment and resets the asset to AVAILABLE', async () => {
      const asset = await createAsset(org);
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId })
        .expect(201);

      const returned = await request(app.getHttpServer())
        .put(`/api/v1/assets/${asset.id}/return`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ conditionOnReturn: 'Minor scratches' })
        .expect(200);
      expect(returned.body.data.status).toBe('AVAILABLE');

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/assets/${asset.id}`)
        .set(authed(org.adminToken, org.organizationId))
        .expect(200);
      expect(detail.body.data.assignments[0].returnedAt).not.toBeNull();
      expect(detail.body.data.assignments[0].conditionOnReturn).toBe('Minor scratches');
    });

    it('supports returning into a non-default status (e.g. UNDER_MAINTENANCE)', async () => {
      const asset = await createAsset(org);
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId })
        .expect(201);

      const returned = await request(app.getHttpServer())
        .put(`/api/v1/assets/${asset.id}/return`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ conditionOnReturn: 'Damaged', newStatus: 'UNDER_MAINTENANCE' })
        .expect(200);
      expect(returned.body.data.status).toBe('UNDER_MAINTENANCE');
    });

    it('rejects returning an AVAILABLE (not currently assigned) asset', async () => {
      const asset = await createAsset(org);
      await request(app.getHttpServer())
        .put(`/api/v1/assets/${asset.id}/return`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ conditionOnReturn: 'n/a' })
        .expect(400);
    });

    it('a read-only user gets 403 returning', async () => {
      const asset = await createAsset(org);
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId })
        .expect(201);
      await request(app.getHttpServer())
        .put(`/api/v1/assets/${asset.id}/return`)
        .set(authed(org.readOnlyToken, org.organizationId))
        .send({ conditionOnReturn: 'n/a' })
        .expect(403);
    });
  });

  // ─── History accumulation ────────────────────────────────────────────────

  describe('Assignment history accumulation', () => {
    it('assign -> return -> re-assign produces TWO assignment rows, never overwrites the first', async () => {
      const org = await createOrgFixture('history');
      const asset = await createAsset(org);

      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId, conditionOnIssue: 'First issue' })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/api/v1/assets/${asset.id}/return`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ conditionOnReturn: 'First return' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.otherEmployeeId, conditionOnIssue: 'Second issue' })
        .expect(201);

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/assets/${asset.id}`)
        .set(authed(org.adminToken, org.organizationId))
        .expect(200);

      expect(detail.body.data.assignments).toHaveLength(2);
      const conditions = detail.body.data.assignments
        .map((a: { conditionOnIssue: string }) => a.conditionOnIssue)
        .sort();
      expect(conditions).toEqual(['First issue', 'Second issue']);

      // the first (now-closed) assignment must still carry its own returnedAt/conditionOnReturn —
      // proof the second assign did not overwrite/reuse the first row.
      const closedRow = detail.body.data.assignments.find(
        (a: { conditionOnIssue: string }) => a.conditionOnIssue === 'First issue',
      );
      expect(closedRow.returnedAt).not.toBeNull();
      expect(closedRow.conditionOnReturn).toBe('First return');
      const openRow = detail.body.data.assignments.find(
        (a: { conditionOnIssue: string }) => a.conditionOnIssue === 'Second issue',
      );
      expect(openRow.returnedAt).toBeNull();
    });
  });

  // ─── Employee assignment history endpoint ───────────────────────────────

  describe('Employee assignment history', () => {
    it('GET /assets/employee/:employeeId/history returns accumulated rows for that employee', async () => {
      const org = await createOrgFixture('emp-history');
      const asset = await createAsset(org);

      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId })
        .expect(201);
      await request(app.getHttpServer())
        .put(`/api/v1/assets/${asset.id}/return`)
        .set(authed(org.adminToken, org.organizationId))
        .send({})
        .expect(200);

      const asset2 = await createAsset(org, { type: 'ID_CARD', name: 'ID Card' });
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset2.id}/assign`)
        .set(authed(org.adminToken, org.organizationId))
        .send({ employeeId: org.employeeId })
        .expect(201);

      const history = await request(app.getHttpServer())
        .get(`/api/v1/assets/employee/${org.employeeId}/history`)
        .set(authed(org.adminToken, org.organizationId))
        .expect(200);

      expect(history.body.data).toHaveLength(2);
      expect(
        history.body.data.every((a: { employeeId: string }) => a.employeeId === org.employeeId),
      ).toBe(true);
      expect(history.body.data[0].asset).toBeDefined();
    });

    it('returns 404 for an employeeId that belongs to a different org', async () => {
      const orgA = await createOrgFixture('emp-history-cross-a');
      const orgB = await createOrgFixture('emp-history-cross-b');

      await request(app.getHttpServer())
        .get(`/api/v1/assets/employee/${orgA.employeeId}/history`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .expect(404);
    });
  });

  // ─── Org-scoping ─────────────────────────────────────────────────────────

  describe('Organization scoping', () => {
    it('an asset from org A is never visible/actionable from org B (get/assign/return all 404)', async () => {
      const orgA = await createOrgFixture('scoping-a');
      const orgB = await createOrgFixture('scoping-b');
      const asset = await createAsset(orgA);

      await request(app.getHttpServer())
        .get(`/api/v1/assets/${asset.id}`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .expect(404);

      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .send({ employeeId: orgB.employeeId })
        .expect(404);

      // assign for real within org A, then confirm org B still can't return it
      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(orgA.adminToken, orgA.organizationId))
        .send({ employeeId: orgA.employeeId })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/api/v1/assets/${asset.id}/return`)
        .set(authed(orgB.adminToken, orgB.organizationId))
        .send({})
        .expect(404);

      const listB = await request(app.getHttpServer())
        .get('/api/v1/assets')
        .set(authed(orgB.adminToken, orgB.organizationId))
        .query({ limit: 100 })
        .expect(200);
      expect(listB.body.data.data.some((a: { id: string }) => a.id === asset.id)).toBe(false);
    });

    it('assigning an employee from a DIFFERENT org to an asset is rejected (employee not found in this org)', async () => {
      const orgA = await createOrgFixture('scoping-emp-a');
      const orgB = await createOrgFixture('scoping-emp-b');
      const asset = await createAsset(orgA);

      await request(app.getHttpServer())
        .post(`/api/v1/assets/${asset.id}/assign`)
        .set(authed(orgA.adminToken, orgA.organizationId))
        .send({ employeeId: orgB.employeeId })
        .expect(404);
    });
  });
});
