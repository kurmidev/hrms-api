import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@prisma/prisma.service';

@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 8 * * *')
  async sendPaymentReminders() {
    const now = new Date();
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: { status: 'SENT', dueDate: { lt: now } },
      include: { organization: { select: { email: true, name: true } } },
    });

    for (const invoice of overdueInvoices) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'OVERDUE' },
      });

      await this.prisma.organizationSubscription.updateMany({
        where: { organizationId: invoice.organizationId, status: 'ACTIVE' },
        data: { status: 'PAST_DUE' },
      });

      this.logger.log(`Payment reminder: ${invoice.organization.email} - ${invoice.invoiceNumber}`);
    }
  }

  @Cron('5 0 * * *')
  async autoSuspendOverdue() {
    const now = new Date();
    const subs = await this.prisma.organizationSubscription.findMany({
      where: { status: 'PAST_DUE' },
    });

    for (const sub of subs) {
      const suspendDate = new Date(sub.currentPeriodEnd);
      suspendDate.setDate(suspendDate.getDate() + sub.gracePeriodDays);

      if (now > suspendDate) {
        await this.prisma.organizationSubscription.update({
          where: { id: sub.id },
          data: { status: 'SUSPENDED' },
        });
        await this.prisma.organization.update({
          where: { id: sub.organizationId },
          data: { isActive: false },
        });
        this.logger.log(`Auto-suspended org: ${sub.organizationId}`);
      }
    }
  }

  @Cron('0 9 1 * *')
  async generateRenewalInvoices() {
    const now = new Date();
    const subs = await this.prisma.organizationSubscription.findMany({
      where: { status: 'ACTIVE', nextBillingDate: { lte: now } },
      include: { plan: true },
    });

    for (const sub of subs) {
      const days =
        sub.billingCycle === 'MONTHLY' ? 30 : sub.billingCycle === 'QUARTERLY' ? 90 : 365;

      const periodStart = new Date(sub.nextBillingDate);
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + days);
      const nextBillingDate = periodEnd;

      const invoiceCount = await this.prisma.invoice.count();
      const year = now.getFullYear();
      const invoiceNumber = `INV-${year}-${String(invoiceCount + 1).padStart(5, '0')}`;

      const amount =
        sub.billingCycle === 'MONTHLY'
          ? Number(sub.plan.priceMonthly)
          : sub.billingCycle === 'QUARTERLY'
            ? Number(sub.plan.priceQuarterly)
            : Number(sub.plan.priceYearly);
      const taxAmount = amount * 0.18;
      const totalAmount = amount + taxAmount;

      await this.prisma.invoice.create({
        data: {
          invoiceNumber,
          organizationId: sub.organizationId,
          subscriptionId: sub.id,
          amount,
          taxPercent: 18,
          taxAmount,
          totalAmount,
          status: 'SENT',
          dueDate: new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000),
          periodStart,
          periodEnd,
        },
      });

      await this.prisma.organizationSubscription.update({
        where: { id: sub.id },
        data: { nextBillingDate, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
      });

      this.logger.log(`Renewal invoice created: ${invoiceNumber}`);
    }
  }
}
