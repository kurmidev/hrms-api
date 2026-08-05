import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate } from '@common/dto/pagination.dto';
import { CreateDisciplinaryMemoDto } from './dto/create-disciplinary-memo.dto';
import { QueryDisciplinaryMemoDto } from './dto/query-disciplinary-memo.dto';

const TERMINATION_REVIEW_THRESHOLD = 5;
const ACTIVE_MEMO_STATUS = 'active';

@Injectable()
export class DisciplinaryService {
  private readonly logger = new Logger(DisciplinaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(organizationId: string, issuedBy: string, dto: CreateDisciplinaryMemoDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, flaggedForTerminationReview: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const memo = await this.prisma.disciplinaryMemo.create({
      data: {
        organizationId,
        employeeId: dto.employeeId,
        type: dto.type,
        title: dto.title,
        reason: dto.reason,
        issuedBy,
        issuingAuthority: dto.issuingAuthority,
        approvalReference: dto.approvalReference,
        ...(dto.issuedAt && { issuedAt: new Date(dto.issuedAt) }),
      },
    });

    const activeMemoCount = await this.prisma.disciplinaryMemo.count({
      where: { organizationId, employeeId: dto.employeeId, status: ACTIVE_MEMO_STATUS },
    });

    let terminationReviewTriggered = false;
    if (activeMemoCount >= TERMINATION_REVIEW_THRESHOLD && !employee.flaggedForTerminationReview) {
      await this.prisma.employee.update({
        where: { id: dto.employeeId },
        data: { flaggedForTerminationReview: true, terminationReviewFlaggedAt: new Date() },
      });
      terminationReviewTriggered = true;
      await this.notifyTerminationReview(organizationId, employee, activeMemoCount);
    }

    return { ...this.toResponse(memo), terminationReviewTriggered };
  }

  async findAll(organizationId: string, query: QueryDisciplinaryMemoDto) {
    const where: Prisma.DisciplinaryMemoWhereInput = {
      organizationId,
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.disciplinaryMemo.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.disciplinaryMemo.count({ where }),
    ]);

    return paginate(
      data.map((memo) => this.toResponse(memo)),
      total,
      query,
    );
  }

  async findOne(organizationId: string, id: string) {
    const memo = await this.prisma.disciplinaryMemo.findFirst({ where: { id, organizationId } });
    if (!memo) throw new NotFoundException('Disciplinary memo not found');
    return this.toResponse(memo);
  }

  async getEmployeeSummary(organizationId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: { id: true, flaggedForTerminationReview: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const activeMemoCount = await this.prisma.disciplinaryMemo.count({
      where: { organizationId, employeeId, status: ACTIVE_MEMO_STATUS },
    });

    return {
      employeeId,
      activeMemoCount,
      threshold: TERMINATION_REVIEW_THRESHOLD,
      flaggedForTerminationReview: employee.flaggedForTerminationReview,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async notifyTerminationReview(
    organizationId: string,
    employee: { id: string; firstName: string; lastName: string },
    activeMemoCount: number,
  ): Promise<void> {
    try {
      const recipients = await this.prisma.user.findMany({
        where: {
          organizationId,
          isActive: true,
          userRoles: { some: { role: { name: { in: ['org_admin', 'hr_manager'] } } } },
        },
        select: { email: true },
      });

      const subject = `Termination review flag: ${employee.firstName} ${employee.lastName}`;
      const html = `<p>${employee.firstName} ${employee.lastName} has reached ${activeMemoCount} active disciplinary memos (threshold: ${TERMINATION_REVIEW_THRESHOLD}) and has been flagged for termination review. Please review via HRMS.</p>`;

      for (const recipient of recipients) {
        if (recipient.email) {
          await this.notifications.sendEmail(recipient.email, subject, html);
        }
      }
      if (recipients.length === 0) {
        this.logger.warn(
          `No org_admin/hr_manager recipients found for termination-review notification (org ${organizationId}, employee ${employee.id})`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to send termination-review notification for employee ${employee.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private toResponse(memo: {
    id: string;
    organizationId: string;
    employeeId: string;
    title: string;
    type: string;
    reason: string;
    issuedBy: string;
    issuingAuthority: string | null;
    approvalReference: string | null;
    issuedAt: Date;
    acknowledgedAt: Date | null;
    status: string;
    updatedAt: Date;
  }) {
    return {
      id: memo.id,
      organizationId: memo.organizationId,
      employeeId: memo.employeeId,
      title: memo.title,
      type: memo.type,
      reason: memo.reason,
      issuedBy: memo.issuedBy,
      issuingAuthority: memo.issuingAuthority,
      approvalReference: memo.approvalReference,
      issuedAt: memo.issuedAt,
      acknowledgedAt: memo.acknowledgedAt,
      status: memo.status,
      updatedAt: memo.updatedAt,
    };
  }
}
