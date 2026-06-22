import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnboardingStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OnboardingScheduler {
  private readonly logger = new Logger(OnboardingScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireStaleLinks() {
    const now = new Date();

    const stale = await this.prisma.onboardingLink.findMany({
      where: {
        status: { in: [OnboardingStatus.PENDING, OnboardingStatus.IN_PROGRESS] },
        expiresAt: { lt: now },
      },
      select: { id: true, status: true },
    });

    if (!stale.length) return;

    await Promise.all(
      stale.map((link) =>
        this.prisma.$transaction([
          this.prisma.onboardingLink.update({
            where: { id: link.id },
            data: { status: OnboardingStatus.EXPIRED },
          }),
          this.prisma.onboardingTransition.create({
            data: {
              onboardingLinkId: link.id,
              fromStatus: link.status,
              toStatus: OnboardingStatus.EXPIRED,
              actorType: 'SYSTEM',
              notes: 'Automatically expired by scheduler',
            },
          }),
        ]),
      ),
    );

    this.logger.log(`Expired ${stale.length} stale onboarding link(s)`);
  }
}
