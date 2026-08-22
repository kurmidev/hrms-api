/**
 * One-off data-fix: set maxConsecutiveDays = 1 for every LeavePolicyType where
 * leaveType = 'CASUAL' AND maxConsecutiveDays IS NULL.
 *
 * Idempotent — re-running only touches rows that are still NULL, never
 * overwrites a value an admin has already configured.
 *
 * Usage: npx ts-node prisma/backfill-casual-leave-max-consecutive-days.ts
 */
import { LeaveType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.leavePolicyType.updateMany({
    where: { leaveType: LeaveType.CASUAL, maxConsecutiveDays: null },
    data: { maxConsecutiveDays: 1 },
  });
  console.log(
    `Backfilled maxConsecutiveDays=1 for ${result.count} CASUAL leave policy type row(s).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
