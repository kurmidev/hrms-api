import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NoticesScheduler {
  private readonly logger = new Logger(NoticesScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Materializes due `scheduled` notices to `published`. This is a convenience
   * only — the board query rule (`status='published' OR (status='scheduled'
   * AND scheduledAt <= now)`) already makes scheduled notices visible at their
   * due time deterministically, independent of this cron's timing.
   */
  @Cron('*/1 * * * *')
  async publishDueScheduledNotices() {
    const now = new Date();

    const due = await this.prisma.notice.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: now } },
      select: { id: true },
    });

    if (!due.length) return;

    await this.prisma.notice.updateMany({
      where: { id: { in: due.map((n) => n.id) } },
      data: { status: 'published', publishedAt: now },
    });

    this.logger.log(`Published ${due.length} due scheduled notice(s)`);
  }
}
