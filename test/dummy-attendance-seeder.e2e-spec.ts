import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Verification suite for the standalone dummy AttendanceLog history seeder
 * (backend/prisma/seed-dummy-attendance.ts). This job has NO API surface
 * and NO frontend page, so verification here covers only what such a job
 * *can* be verified against: real DB state after seeding.
 *
 * This spec does NOT re-run the seeder — it asserts invariants against
 * whatever window is currently seeded (derived dynamically from MIN/MAX
 * AttendanceLog.date for the org, not hardcoded dates), so it stays valid
 * across re-runs on different days. Idempotency itself (re-run produces a
 * stable row count and byte-identical field values) was verified manually
 * per docs/known-issues.md and is not re-asserted here since it requires
 * actually invoking the script twice, which is out of scope for a fast
 * Jest run.
 *
 * Assumes `npm run seed:dummy-attendance` has already been run at least
 * once against the local dev DB for org slug 'igreen-technologies' (which
 * itself assumes `npm run prisma:seed` and `npm run seed:employees-payroll`
 * ran first).
 */
describe('Dummy attendance seeder — DB invariants (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ORG_SLUG = 'igreen-technologies';
  const MS_PER_DAY = 24 * 3600000;
  const MS_PER_HOUR = 3600000;
  const HQ_NAME = 'iGreen Technologies HQ';

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

  async function getOrgAndEmployees() {
    const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
    expect(org).not.toBeNull();
    const employees = await prisma.employee.findMany({
      where: { organizationId: org!.id, deletedAt: null },
    });
    expect(employees.length).toBeGreaterThan(0);
    return { org: org!, employees };
  }

  it('has exactly one AttendanceLog row per employee per calendar day in the seeded window (no gaps, no dupes)', async () => {
    const { org, employees } = await getOrgAndEmployees();
    const employeeIds = employees.map((e) => e.id);

    const logs = await prisma.attendanceLog.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { employeeId: true, date: true },
    });
    expect(logs.length).toBeGreaterThan(0);

    const dateTimes = logs.map((l) => l.date.getTime());
    const minDate = Math.min(...dateTimes);
    const maxDate = Math.max(...dateTimes);
    const totalDays = Math.round((maxDate - minDate) / MS_PER_DAY) + 1;

    expect(logs.length).toBe(employees.length * totalDays);

    const byEmployee = new Map<string, Set<number>>();
    for (const log of logs) {
      const set = byEmployee.get(log.employeeId) ?? new Set<number>();
      set.add(log.date.getTime());
      byEmployee.set(log.employeeId, set);
    }
    expect(byEmployee.size).toBe(employees.length);
    for (const set of byEmployee.values()) {
      // No duplicate (employeeId, date) rows collapsed by the Set, and every
      // employee has a row for every day in the window.
      expect(set.size).toBe(totalDays);
    }
  });

  it('every AttendanceLog.date is exactly UTC-midnight (§19 regression guard)', async () => {
    const { employees } = await getOrgAndEmployees();
    const employeeIds = employees.map((e) => e.id);

    const logs = await prisma.attendanceLog.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { date: true },
    });

    for (const log of logs) {
      expect(log.date.getUTCHours()).toBe(0);
      expect(log.date.getUTCMinutes()).toBe(0);
      expect(log.date.getUTCSeconds()).toBe(0);
      expect(log.date.getUTCMilliseconds()).toBe(0);
    }
  });

  it('WEEK_OFF rows fall only on Sundays, and every non-holiday Sunday is WEEK_OFF', async () => {
    const { org, employees } = await getOrgAndEmployees();
    const employeeIds = employees.map((e) => e.id);

    const logs = await prisma.attendanceLog.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { date: true, status: true },
    });

    for (const log of logs) {
      if (log.status === 'WEEK_OFF') {
        expect(log.date.getUTCDay()).toBe(0);
      }
    }

    const sundayLogs = logs.filter((l) => l.date.getUTCDay() === 0);
    for (const log of sundayLogs) {
      expect(['WEEK_OFF', 'HOLIDAY']).toContain(log.status);
    }
  });

  it('every seeded holiday date has a HOLIDAY row for all employees and no other status', async () => {
    const { org, employees } = await getOrgAndEmployees();
    const employeeIds = employees.map((e) => e.id);

    const holidays = await prisma.holiday.findMany({ where: { organizationId: org.id } });
    expect(holidays.length).toBeGreaterThan(0);

    for (const holiday of holidays) {
      const rowsOnDate = await prisma.attendanceLog.findMany({
        where: { employeeId: { in: employeeIds }, date: holiday.date },
      });
      expect(rowsOnDate.length).toBe(employees.length);
      for (const row of rowsOnDate) {
        expect(row.status).toBe('HOLIDAY');
        expect(row.checkInAt).toBeNull();
        expect(row.checkOutAt).toBeNull();
        expect(row.totalHours).toBeNull();
        expect(row.overtimeHours).toBeNull();
      }
    }
  });

  it('PRESENT rows have correct totalHours/overtimeHours; non-PRESENT rows have null check-in/out/hours', async () => {
    const { employees } = await getOrgAndEmployees();
    const employeeIds = employees.map((e) => e.id);

    const logs = await prisma.attendanceLog.findMany({
      where: { employeeId: { in: employeeIds } },
    });
    const presentLogs = logs.filter((l) => l.status === 'PRESENT');
    const nonPresentLogs = logs.filter((l) => l.status !== 'PRESENT');
    expect(presentLogs.length).toBeGreaterThan(0);

    for (const log of presentLogs) {
      expect(log.checkInAt).not.toBeNull();
      expect(log.checkOutAt).not.toBeNull();
      const expectedTotal = (log.checkOutAt!.getTime() - log.checkInAt!.getTime()) / MS_PER_HOUR;
      const expectedOvertime = Math.max(0, expectedTotal - 8);
      expect(log.totalHours).toBeCloseTo(expectedTotal, 6);
      expect(log.overtimeHours).toBeCloseTo(expectedOvertime, 6);
    }

    for (const log of nonPresentLogs) {
      expect(log.checkInAt).toBeNull();
      expect(log.checkOutAt).toBeNull();
      expect(log.totalHours).toBeNull();
      expect(log.overtimeHours).toBeNull();
    }
  });

  it('resolves checkInLocationName to the seeded HQ name or the Unrecognized Location sentinel only', async () => {
    const { org, employees } = await getOrgAndEmployees();
    const employeeIds = employees.map((e) => e.id);

    const workLocations = await prisma.workLocation.findMany({ where: { organizationId: org.id } });
    expect(workLocations).toHaveLength(1);
    expect(workLocations[0].name).toBe(HQ_NAME);

    const presentLogs = await prisma.attendanceLog.findMany({
      where: { employeeId: { in: employeeIds }, status: 'PRESENT' },
      select: { checkInLocationName: true, checkOutLocationName: true },
    });

    const allowedNames = new Set([HQ_NAME, 'Unrecognized Location']);
    const seenNames = new Set<string>();
    for (const log of presentLogs) {
      expect(allowedNames.has(log.checkInLocationName ?? '')).toBe(true);
      expect(allowedNames.has(log.checkOutLocationName ?? '')).toBe(true);
      if (log.checkInLocationName) seenNames.add(log.checkInLocationName);
    }
    // Both the resolved-HQ and outlier-noise cases must actually occur in
    // the seeded data (a seeder that never generates outliers, or one whose
    // radius check is broken so everything resolves the same way, would
    // silently pass a naive "no bad values" check but fail this).
    expect(seenNames.has(HQ_NAME)).toBe(true);
    expect(seenNames.has('Unrecognized Location')).toBe(true);
  });

  it('writes the employee-logins.md credentials file with one row per active employee', async () => {
    const { employees } = await getOrgAndEmployees();
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(__dirname, '..', 'prisma', 'data', 'employee-logins.md');

    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/WARNING/i);
    expect(content).toContain('| Name | Emp Code | Login Email | Password |');

    const dataRows = content
      .split('\n')
      .filter((line) => line.startsWith('| ') && line.includes('123456'));
    expect(dataRows.length).toBe(employees.length);
  });
});
