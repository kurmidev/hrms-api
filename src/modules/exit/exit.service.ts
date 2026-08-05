import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeStatus, ExitStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { AssetsService } from '../assets/assets.service';
import { LoansService } from '../loans/loans.service';
import { EmployeesService } from '../employees/employees.service';
import { CreateExitDto } from './dto/create-exit.dto';
import { QueryExitDto } from './dto/query-exit.dto';
import { UpdateClearanceDto } from './dto/update-clearance.dto';
import { SettleExitDto } from './dto/settle-exit.dto';

const TARGET_SETTLEMENT_DAYS = 45;

interface DepartmentClearance {
  department: string;
  cleared: boolean;
  clearedBy: string | null;
  clearedAt: string | null;
}

interface ClearanceStatus {
  departments: DepartmentClearance[];
  assetHandover: { cleared: boolean; unreturnedCount: number };
  knowledgeTransfer: { cleared: boolean };
}

@Injectable()
export class ExitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetsService: AssetsService,
    private readonly loansService: LoansService,
    private readonly employeesService: EmployeesService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateExitDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const existing = await this.prisma.exitRecord.findFirst({
      where: { employeeId: dto.employeeId, organizationId },
    });
    if (existing) {
      throw new ConflictException('An exit record already exists for this employee');
    }

    const departments = await this.prisma.department.findMany({
      where: { organizationId, deletedAt: null },
      select: { name: true },
    });

    const initiatedAt = new Date();
    const targetSettlementDate = dto.targetSettlementDate
      ? new Date(dto.targetSettlementDate)
      : new Date(initiatedAt.getTime() + TARGET_SETTLEMENT_DAYS * 24 * 60 * 60 * 1000);

    const clearanceStatus: ClearanceStatus = {
      departments: departments.map((d) => ({
        department: d.name,
        cleared: false,
        clearedBy: null,
        clearedAt: null,
      })),
      assetHandover: { cleared: false, unreturnedCount: 0 },
      knowledgeTransfer: { cleared: false },
    };

    const record = await this.prisma.exitRecord.create({
      data: {
        organizationId,
        employeeId: dto.employeeId,
        type: dto.type,
        initiatedBy: dto.initiatedBy,
        reason: dto.reason,
        initiatedAt,
        noticeStartDate: dto.noticeStartDate ? new Date(dto.noticeStartDate) : null,
        lastWorkingDate: dto.lastWorkingDate ? new Date(dto.lastWorkingDate) : null,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
        targetSettlementDate,
        clearanceStatus: clearanceStatus as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    return this.toResponse(record);
  }

  async findAll(organizationId: string, query: QueryExitDto) {
    const where: Prisma.ExitRecordWhereInput = {
      organizationId,
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.exitRecord.findMany({
        where,
        orderBy: { initiatedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.exitRecord.count({ where }),
    ]);

    return paginate(
      data.map((record) => this.toResponse(record)),
      total,
      query,
    );
  }

  async findOne(organizationId: string, id: string) {
    const record = await this.getOrThrow(organizationId, id);
    return this.toResponse(record);
  }

  async updateClearance(organizationId: string, id: string, dto: UpdateClearanceDto) {
    const record = await this.getOrThrow(organizationId, id);

    if (record.status === ExitStatus.SETTLED || record.status === ExitStatus.COMPLETED) {
      throw new BadRequestException('Clearance can no longer be updated after settlement');
    }

    const current = this.parseClearanceStatus(record.clearanceStatus);

    if (dto.departments) {
      for (const update of dto.departments) {
        const existingDept = current.departments.find(
          (d) => d.department.toLowerCase() === update.department.toLowerCase(),
        );
        const entry: DepartmentClearance = {
          department: update.department,
          cleared: update.cleared,
          clearedBy: update.cleared ? (update.clearedBy ?? null) : null,
          clearedAt: update.cleared ? new Date().toISOString() : null,
        };
        if (existingDept) {
          Object.assign(existingDept, entry);
        } else {
          current.departments.push(entry);
        }
      }
    }

    const unreturnedCount = await this.assetsService.countUnreturnedAssignmentsForEmployee(
      organizationId,
      record.employeeId,
    );
    current.assetHandover = { cleared: unreturnedCount === 0, unreturnedCount };

    if (dto.knowledgeTransferComplete !== undefined) {
      current.knowledgeTransfer = { cleared: dto.knowledgeTransferComplete };
    }

    const allDepartmentsCleared = current.departments.every((d) => d.cleared);
    const allCleared =
      allDepartmentsCleared && current.assetHandover.cleared && current.knowledgeTransfer.cleared;

    const advance = dto.advanceToClearedIfComplete ?? true;
    const nextStatus =
      advance && allCleared
        ? ExitStatus.CLEARED
        : record.status === ExitStatus.INITIATED
          ? ExitStatus.CLEARANCE_PENDING
          : record.status;

    const updated = await this.prisma.exitRecord.update({
      where: { id },
      data: {
        clearanceStatus: current as unknown as Prisma.InputJsonValue,
        knowledgeTransferComplete: current.knowledgeTransfer.cleared,
        status: nextStatus,
        ...(nextStatus === ExitStatus.CLEARED && { nocIssuedAt: new Date() }),
      },
    });

    return this.toResponse(updated);
  }

  async settle(organizationId: string, userId: string, id: string, dto: SettleExitDto) {
    const record = await this.getOrThrow(organizationId, id);

    if (record.status !== ExitStatus.CLEARED) {
      throw new BadRequestException('Settlement is only permitted once the exit is CLEARED');
    }

    const [outstandingLoanBalance, unreturnedAssetCount] = await Promise.all([
      this.loansService.getOutstandingBalanceForEmployee(organizationId, record.employeeId),
      this.assetsService.countUnreturnedAssignmentsForEmployee(organizationId, record.employeeId),
    ]);

    const updated = await this.prisma.exitRecord.update({
      where: { id },
      data: {
        settlementAmount: dto.settlementAmount,
        settledAt: new Date(),
        status: ExitStatus.SETTLED,
      },
    });

    await this.employeesService.patchStatus(
      organizationId,
      record.employeeId,
      { status: EmployeeStatus.EXITED, reason: record.reason ?? 'Exit settled' },
      userId,
    );

    return {
      exitRecord: this.toResponse(updated),
      outstandingLoanBalance,
      unreturnedAssetCount,
      settlementAmount: dto.settlementAmount,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async getOrThrow(organizationId: string, id: string) {
    const record = await this.prisma.exitRecord.findFirst({ where: { id, organizationId } });
    if (!record) throw new NotFoundException('Exit record not found');
    return record;
  }

  private parseClearanceStatus(value: Prisma.JsonValue | null): ClearanceStatus {
    if (!value || typeof value !== 'object') {
      return {
        departments: [],
        assetHandover: { cleared: false, unreturnedCount: 0 },
        knowledgeTransfer: { cleared: false },
      };
    }
    return value as unknown as ClearanceStatus;
  }

  private toResponse(record: {
    id: string;
    organizationId: string;
    employeeId: string;
    type: string;
    status: string;
    initiatedBy: string;
    reason: string | null;
    initiatedAt: Date;
    noticeStartDate: Date | null;
    lastWorkingDate: Date | null;
    effectiveDate: Date | null;
    targetSettlementDate: Date | null;
    knowledgeTransferComplete: boolean;
    clearanceStatus: Prisma.JsonValue | null;
    nocIssuedAt: Date | null;
    settlementAmount: number | null;
    settledAt: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
  }) {
    return {
      id: record.id,
      organizationId: record.organizationId,
      employeeId: record.employeeId,
      type: record.type,
      status: record.status,
      initiatedBy: record.initiatedBy,
      reason: record.reason,
      initiatedAt: record.initiatedAt,
      noticeStartDate: record.noticeStartDate,
      lastWorkingDate: record.lastWorkingDate,
      effectiveDate: record.effectiveDate,
      targetSettlementDate: record.targetSettlementDate,
      knowledgeTransferComplete: record.knowledgeTransferComplete,
      clearanceStatus: record.clearanceStatus,
      nocIssuedAt: record.nocIssuedAt,
      settlementAmount: record.settlementAmount,
      settledAt: record.settledAt,
      completedAt: record.completedAt,
      updatedAt: record.updatedAt,
    };
  }
}
