/**
 * Standalone 3-month dummy AttendanceLog seeder.
 *
 * Generates ~3 months of realistic attendance history for every active
 * employee of the `igreen-technologies` org (the existing 26, seeded by
 * `seed.ts` + `seed-employees-payroll.ts`), so the system looks like it has
 * been in active daily use. Also seeds one WorkLocation (HQ) and a handful
 * of real Indian public holidays that fall inside the computed window.
 *
 * NOT a NestJS module/controller/endpoint — pure data population via a raw
 * PrismaClient. Run via:
 *   npm run seed:dummy-attendance
 *
 * See docs/modules/dummy-attendance-seeder.md for the full design and
 * docs/known-issues.md 2026-08-14 / .claude/agents/hrms-backend.md §19 for
 * why `startOfDay()` MUST build a UTC-midnight Date (never local-midnight
 * `setHours(0,0,0,0)`) — this is copied verbatim from
 * `src/modules/attendance/attendance.service.ts` for that reason.
 *
 * Idempotency: every AttendanceLog row is generated with values derived from
 * a PRNG seeded deterministically by `${employeeId}:${dateISO}`, and written
 * via `upsert` on the `employeeId_date` compound unique key — so re-running
 * this script produces byte-identical field values and a stable row count,
 * not just "no duplicate rows" (see .claude/agents/hrms-backend.md §10/§18
 * for why idempotent seed/recompute scripts must not silently drift).
 */
import { AttendanceStatus, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const ORG_SLUG = 'igreen-technologies';
const LOGINS_REPORT_PATH = path.join(__dirname, 'data', 'employee-logins.md');
const PLACEHOLDER_PASSWORD = '123456';

// ─── Constants ported verbatim from attendance.service.ts ──────────────────
const STANDARD_WORKDAY_HOURS = 8;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 24 * 3600000;

/**
 * Builds a UTC-midnight Date for the LOCAL calendar day of `date`, matching
 * how MySQL round-trips a `@db.Date` column (the mysql2 driver serializes/
 * deserializes DATE values in UTC). Copied VERBATIM from
 * `src/modules/attendance/attendance.service.ts` — never use
 * `d.setHours(0, 0, 0, 0)` (local midnight) here, see rule #19 /
 * docs/known-issues.md 2026-08-14.
 */
function startOfDay(date: Date | string): Date {
  const d = new Date(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// ─── Haversine + resolveLocationName, ported from work-locations.service.ts ─
const UNRECOGNIZED_LOCATION = 'Unrecognized Location';
const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

interface WorkLocationLike {
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

/** Must produce identical output to WorkLocationsService.resolveLocationName. */
function resolveLocationName(locations: WorkLocationLike[], lat: number, lng: number): string {
  let nearestName: string | null = null;
  let nearestDistance = Infinity;

  for (const location of locations) {
    const distance = haversineDistanceMeters(lat, lng, location.lat, location.lng);
    if (distance <= location.radiusMeters && distance < nearestDistance) {
      nearestDistance = distance;
      nearestName = location.name;
    }
  }

  return nearestName ?? UNRECOGNIZED_LOCATION;
}

// ─── Deterministic per-(employee, day) PRNG ─────────────────────────────────
// Seeded by `${employeeId}:${dateISO}` so re-running the script generates the
// EXACT same field values for the same row — true idempotency, not merely
// "no duplicate rows created".
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return function random(): number {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── HQ WorkLocation ─────────────────────────────────────────────────────────
const HQ_NAME = 'iGreen Technologies HQ';
const HQ_LAT = 13.0827; // Chennai, Tamil Nadu
const HQ_LNG = 80.2707;
const HQ_RADIUS_METERS = 300;

const METERS_PER_DEGREE_LAT = 111320;

/** Random offset point at `distanceMeters` from (lat, lng) in a random direction. */
function offsetCoords(
  lat: number,
  lng: number,
  distanceMeters: number,
  rng: () => number,
): { lat: number; lng: number } {
  const bearing = rng() * 2 * Math.PI;
  const dLat = (distanceMeters * Math.cos(bearing)) / METERS_PER_DEGREE_LAT;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(toRadians(lat));
  const dLng = (distanceMeters * Math.sin(bearing)) / metersPerDegreeLng;
  return { lat: lat + dLat, lng: lng + dLng };
}

// ─── Real Indian public holidays inside the computed window ────────────────
// Populated after the window is computed, below — kept as a function of
// (rangeStart, rangeEnd) so the set only ever includes dates that actually
// land inside the 3-month window for the *current* run date, per the
// module plan ("compute window first, then include only those that land in
// it"). Fixed-date national holidays use their real Gregorian date every
// year; the Islamic-calendar ones (Bakrid/Eid al-Adha, Muharram) are
// lunar-sighting-dependent and use the commonly published estimate for the
// relevant year(s) covered by the window.
interface HolidayDef {
  name: string;
  date: Date; // UTC-midnight, via startOfDay
}

function buildHolidayCandidates(): HolidayDef[] {
  return [
    { name: 'Republic Day', date: startOfDay('2026-01-26') },
    { name: 'Bakrid / Eid al-Adha', date: startOfDay('2026-05-27') },
    { name: 'Muharram', date: startOfDay('2026-06-16') },
    { name: 'Independence Day', date: startOfDay('2026-08-15') },
    { name: 'Gandhi Jayanti', date: startOfDay('2026-10-02') },
    { name: 'Diwali (Deepavali)', date: startOfDay('2026-11-08') },
    { name: 'Christmas', date: startOfDay('2026-12-25') },
    // Also cover the tail end of 2025 in case the window straddles years
    // when this script is next re-run further in the future.
    { name: 'Gandhi Jayanti', date: startOfDay('2025-10-02') },
    { name: 'Diwali (Deepavali)', date: startOfDay('2025-10-20') },
    { name: 'Christmas', date: startOfDay('2025-12-25') },
    { name: 'Republic Day', date: startOfDay('2025-01-26') },
  ];
}

async function main(): Promise<void> {
  console.log('Starting dummy attendance seeder...');

  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    throw new Error(
      `Organization with slug "${ORG_SLUG}" not found. Run "npm run prisma:seed" and ` +
        `"npm run seed:employees-payroll" first, then re-run this script.`,
    );
  }

  const employees = await prisma.employee.findMany({
    where: { organizationId: org.id, deletedAt: null },
    include: { user: true },
    orderBy: { empCode: 'asc' },
  });
  if (employees.length === 0) {
    throw new Error(
      `No active employees found for organization "${org.name}". Run "npm run seed:employees-payroll" first, then re-run this script.`,
    );
  }

  // ─── Date range: last 3 full months ending today ─────────────────────────
  // Defined as [today - 3 calendar months, today], inclusive on both ends,
  // both boundaries normalized to UTC-midnight via startOfDay(). E.g. for a
  // run on 2026-08-15, the window is 2026-05-15 .. 2026-08-15 inclusive.
  const today = new Date();
  const rangeEnd = startOfDay(today);
  const rangeStartRaw = new Date(today);
  rangeStartRaw.setMonth(rangeStartRaw.getMonth() - 3);
  const rangeStart = startOfDay(rangeStartRaw);

  // ─── WorkLocation (idempotent) ────────────────────────────────────────────
  let workLocation = await prisma.workLocation.findFirst({
    where: { organizationId: org.id, name: HQ_NAME },
  });
  let workLocationCreated = false;
  if (!workLocation) {
    workLocation = await prisma.workLocation.create({
      data: {
        organizationId: org.id,
        name: HQ_NAME,
        lat: HQ_LAT,
        lng: HQ_LNG,
        radiusMeters: HQ_RADIUS_METERS,
        isActive: true,
      },
    });
    workLocationCreated = true;
  }
  const activeLocations: WorkLocationLike[] = [
    {
      name: workLocation.name,
      lat: workLocation.lat,
      lng: workLocation.lng,
      radiusMeters: workLocation.radiusMeters,
    },
  ];

  // ─── Holidays inside the window (idempotent) ──────────────────────────────
  const holidayCandidates = buildHolidayCandidates().filter(
    (h) => h.date.getTime() >= rangeStart.getTime() && h.date.getTime() <= rangeEnd.getTime(),
  );
  const seededHolidays: { name: string; date: Date }[] = [];
  for (const holiday of holidayCandidates) {
    const existing = await prisma.holiday.findFirst({
      where: { organizationId: org.id, date: holiday.date },
    });
    if (!existing) {
      await prisma.holiday.create({
        data: {
          organizationId: org.id,
          name: holiday.name,
          date: holiday.date,
          type: 'national',
        },
      });
    }
    seededHolidays.push({ name: holiday.name, date: holiday.date });
  }
  const holidayDateSet = new Set(seededHolidays.map((h) => h.date.getTime()));

  // ─── Per employee x per day generation ────────────────────────────────────
  const ABSENT_PROBABILITY = 0.05;
  const OUTLIER_LOCATION_PROBABILITY = 0.09;

  let rowsUpserted = 0;
  const totalDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY) + 1;

  for (const employee of employees) {
    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const date = new Date(rangeStart.getTime() + dayOffset * MS_PER_DAY);
      const dateIso = date.toISOString().slice(0, 10);
      const rng = mulberry32(hashStringToInt(`${employee.id}:${dateIso}`));

      const isSunday = date.getUTCDay() === 0;
      const isHoliday = holidayDateSet.has(date.getTime());

      if (isSunday) {
        await upsertLog(employee.id, date, { status: AttendanceStatus.WEEK_OFF });
        rowsUpserted++;
        continue;
      }

      if (isHoliday) {
        await upsertLog(employee.id, date, { status: AttendanceStatus.HOLIDAY });
        rowsUpserted++;
        continue;
      }

      const isAbsent = rng() < ABSENT_PROBABILITY;
      if (isAbsent) {
        await upsertLog(employee.id, date, { status: AttendanceStatus.ABSENT });
        rowsUpserted++;
        continue;
      }

      // PRESENT: check-in 09:00-09:35, weighted toward on-time (bias low via square).
      const checkInMinutesLate = Math.floor(Math.pow(rng(), 2) * 35);
      const checkInAt = new Date(date.getTime());
      checkInAt.setUTCHours(3, 30 + checkInMinutesLate, Math.floor(rng() * 60), 0); // 09:00 IST == 03:30 UTC baseline
      // NOTE: checkInAt/checkOutAt are stored as real timestamps (not @db.Date),
      // so the exact UTC hour used here is cosmetic — what matters for the
      // module's business rules is totalHours/overtimeHours and the `date` key.

      const workedHours = 8 + rng() * 1.5; // ~8h to 9.5h
      const checkOutAt = new Date(checkInAt.getTime() + workedHours * MS_PER_HOUR);

      const totalHours = (checkOutAt.getTime() - checkInAt.getTime()) / MS_PER_HOUR;
      const overtimeHours = Math.max(0, totalHours - STANDARD_WORKDAY_HOURS);

      const isOutlier = rng() < OUTLIER_LOCATION_PROBABILITY;
      const checkInDistance = isOutlier ? 500 + rng() * 1500 : rng() * 250;
      const checkOutDistance = isOutlier ? 500 + rng() * 1500 : rng() * 250;

      const checkInCoords = offsetCoords(HQ_LAT, HQ_LNG, checkInDistance, rng);
      const checkOutCoords = offsetCoords(HQ_LAT, HQ_LNG, checkOutDistance, rng);

      const checkInLocationName = resolveLocationName(
        activeLocations,
        checkInCoords.lat,
        checkInCoords.lng,
      );
      const checkOutLocationName = resolveLocationName(
        activeLocations,
        checkOutCoords.lat,
        checkOutCoords.lng,
      );

      await upsertLog(employee.id, date, {
        status: AttendanceStatus.PRESENT,
        checkInAt,
        checkOutAt,
        checkInLat: checkInCoords.lat,
        checkInLng: checkInCoords.lng,
        checkOutLat: checkOutCoords.lat,
        checkOutLng: checkOutCoords.lng,
        checkInLocationName,
        checkOutLocationName,
        totalHours,
        overtimeHours,
      });
      rowsUpserted++;
    }
  }

  // ─── Credentials output ────────────────────────────────────────────────────
  const loginRows = employees
    .filter((e) => e.user)
    .map((e) => ({
      name: `${e.firstName} ${e.lastName}`.trim(),
      empCode: e.empCode,
      email: e.user!.email,
    }));
  writeLoginsReport(loginRows);

  console.log('\nDummy attendance seeding complete.');
  console.log(`Date range: ${rangeStart.toISOString().slice(0, 10)} .. ${rangeEnd.toISOString().slice(0, 10)}`);
  console.log(`Employees: ${employees.length}`);
  console.log(`AttendanceLog rows upserted: ${rowsUpserted}`);
  console.log(
    `WorkLocation "${HQ_NAME}": ${workLocationCreated ? 'created' : 'reused existing'}`,
  );
  console.log(`Holidays seeded/confirmed in window (${seededHolidays.length}):`);
  for (const h of seededHolidays) {
    console.log(`  - ${h.name}: ${h.date.toISOString().slice(0, 10)}`);
  }
  console.log(`\nCredentials table written to: ${LOGINS_REPORT_PATH}`);
  printLoginsTable(loginRows);

  async function upsertLog(
    employeeId: string,
    date: Date,
    data: {
      status: AttendanceStatus;
      checkInAt?: Date;
      checkOutAt?: Date;
      checkInLat?: number;
      checkInLng?: number;
      checkOutLat?: number;
      checkOutLng?: number;
      checkInLocationName?: string;
      checkOutLocationName?: string;
      totalHours?: number;
      overtimeHours?: number;
    },
  ) {
    const payload = {
      status: data.status,
      source: 'MANUAL' as const,
      checkInAt: data.checkInAt ?? null,
      checkOutAt: data.checkOutAt ?? null,
      checkInLat: data.checkInLat ?? null,
      checkInLng: data.checkInLng ?? null,
      checkOutLat: data.checkOutLat ?? null,
      checkOutLng: data.checkOutLng ?? null,
      checkInLocationName: data.checkInLocationName ?? null,
      checkOutLocationName: data.checkOutLocationName ?? null,
      totalHours: data.totalHours ?? null,
      overtimeHours: data.overtimeHours ?? null,
    };

    await prisma.attendanceLog.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: { employeeId, date, ...payload },
      update: payload,
    });
  }
}

interface LoginRow {
  name: string;
  empCode: string;
  email: string;
}

function writeLoginsReport(rows: LoginRow[]): void {
  const lines: string[] = [];
  lines.push('# Employee Login Credentials');
  lines.push('');
  lines.push(
    '> WARNING: These are placeholder credentials shared across every seeded ' +
      'account (`mustChangePassword: true`). They are meant to be rotated the ' +
      'moment a real user logs in and changes their password — do not treat ' +
      'this file as a production secret store, and do not leave it checked in ' +
      'once real logins have replaced these values.',
  );
  lines.push('');
  lines.push('| Name | Emp Code | Login Email | Password |');
  lines.push('|------|----------|-------------|----------|');
  for (const row of rows) {
    lines.push(`| ${row.name} | ${row.empCode} | ${row.email} | ${PLACEHOLDER_PASSWORD} |`);
  }
  lines.push('');
  fs.writeFileSync(LOGINS_REPORT_PATH, lines.join('\n'), 'utf-8');
}

function printLoginsTable(rows: LoginRow[]): void {
  console.log('| Name | Emp Code | Login Email | Password |');
  console.log('|------|----------|-------------|----------|');
  for (const row of rows) {
    console.log(`| ${row.name} | ${row.empCode} | ${row.email} | ${PLACEHOLDER_PASSWORD} |`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
