import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Verification suite for the one-off CSV employee/payroll import seeder
 * (backend/prisma/seed-employees-payroll.ts). This job has NO API surface
 * and NO frontend page, so verification here covers only what such a job
 * *can* be verified against: real DB state after the import, and that a
 * generated user can actually authenticate through the real login endpoint.
 *
 * This spec does NOT re-run the seeder (that is done manually/via a
 * separate script for idempotency checking — see docs/known-issues.md).
 * It assumes `npm run seed:employees-payroll` has already been run once
 * against the local dev DB for org slug 'igreen-technologies'.
 */
describe('CSV employee/payroll import seeder — DB + login verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ORG_SLUG = 'igreen-technologies';
  const PLACEHOLDER_PASSWORD = '123456';

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
    await app.close();
  });

  it('imported exactly 26 employees / 26 users / 25 payroll structures for the target org', async () => {
    const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
    expect(org).not.toBeNull();

    const employees = await prisma.employee.findMany({ where: { organizationId: org!.id } });
    expect(employees).toHaveLength(26);

    const users = await prisma.user.findMany({
      where: { organizationId: org!.id, employeeId: { not: null } },
    });
    expect(users).toHaveLength(26);

    const payrollStructures = await prisma.payrollStructure.findMany({
      where: { organizationId: org!.id, name: { endsWith: 'Salary Structure' } },
    });
    expect(payrollStructures).toHaveLength(25);
  });

  it('has no duplicate empCode within the org and excludes the 2 ambiguous emp codes', async () => {
    const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
    const employees = await prisma.employee.findMany({
      where: { organizationId: org!.id },
      select: { empCode: true },
    });

    const codes = employees.map((e) => e.empCode);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);

    const ambiguous = await prisma.employee.findMany({
      where: { organizationId: org!.id, empCode: { in: ['...1694', '...1958'] } },
    });
    expect(ambiguous).toHaveLength(0);
  });

  it('logs in a generated employee user with password 123456 and DB reflects mustChangePassword=true', async () => {
    const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
    const sampleUser = await prisma.user.findFirst({
      where: { organizationId: org!.id, employee: { empCode: 'G S1084' } },
    });
    expect(sampleUser).not.toBeNull();
    expect(sampleUser!.mustChangePassword).toBe(true);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: sampleUser!.email, password: PLACEHOLDER_PASSWORD })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(sampleUser!.email);

    // The login response body does NOT echo mustChangePassword (only the
    // JWT payload/DB carries it — see JwtStrategy#validate). Re-fetch from
    // DB to prove the flag is still set post-login.
    const refetched = await prisma.user.findUnique({ where: { id: sampleUser!.id } });
    expect(refetched!.mustChangePassword).toBe(true);
  });
});
