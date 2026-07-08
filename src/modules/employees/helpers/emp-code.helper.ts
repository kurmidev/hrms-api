import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const EMP_CODE_PREFIX = 'EMP';
const MAX_RETRIES = 3;

export async function resolveEmpCode(
  prisma: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  organizationId: string,
  customCode?: string,
): Promise<string> {
  if (customCode) {
    const clash = await (prisma as PrismaClient).employee.findFirst({
      where: { organizationId, empCode: customCode },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`empCode ${customCode} is already in use`);
    return customCode;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const last = await (prisma as PrismaClient).employee.findFirst({
      where: { organizationId },
      orderBy: { empCode: 'desc' },
      select: { empCode: true },
    });

    const lastNum = last ? parseInt(last.empCode.replace(/\D/g, ''), 10) : 0;
    const seq = (isNaN(lastNum) ? 0 : lastNum) + 1 + attempt;
    const candidate = `${EMP_CODE_PREFIX}-${String(seq).padStart(5, '0')}`;

    const taken = await (prisma as PrismaClient).employee.findFirst({
      where: { organizationId, empCode: candidate },
      select: { id: true },
    });

    if (!taken) return candidate;
  }

  throw new ConflictException('Unable to generate a unique employee code after retries. Please try again.');
}
