/**
 * One-off utility: force-resets the two manager/finance test logins
 * (ali1708@igreentec.in, aru1675@igreentec.in) to a known password and
 * confirms their finance_manager/dept_manager role grants — safe to re-run.
 *
 * Use when these accounts already existed before seed-employees-payroll.ts
 * ran (e.g. created via real onboarding, or an earlier seed pass with a
 * different password), so the seeder's "already exists -> skip" path left
 * their original password untouched instead of the seeder's placeholder.
 *
 * Run: npx ts-node -r tsconfig-paths/register prisma/reset-manager-finance-logins.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PLACEHOLDER_PASSWORD = '123456';

const TARGETS: { email: string; roleName: string }[] = [
  { email: 'ali1708@igreentec.in', roleName: 'finance_manager' },
  { email: 'aru1675@igreentec.in', roleName: 'dept_manager' },
];

async function main() {
  const passwordHash = await bcrypt.hash(PLACEHOLDER_PASSWORD, 12);

  for (const { email, roleName } of TARGETS) {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      console.log(`  [SKIP] ${email} — no user with this email exists in this database`);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true, isActive: true },
    });

    const role = await prisma.role.findFirst({
      where: { organizationId: user.organizationId, name: roleName, isSystemRole: true },
    });
    if (!role) {
      console.log(`  [WARN] ${email} — password reset, but role "${roleName}" not found for org ${user.organizationId}`);
      continue;
    }

    const existingGrant = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
    });
    if (!existingGrant) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      console.log(`  [OK] ${email} — password reset to "${PLACEHOLDER_PASSWORD}", granted role "${roleName}"`);
    } else {
      console.log(`  [OK] ${email} — password reset to "${PLACEHOLDER_PASSWORD}", already held role "${roleName}"`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
