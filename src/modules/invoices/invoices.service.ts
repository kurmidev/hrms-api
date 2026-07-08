import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { MarkPaidDto } from './dto/mark-paid.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        skip,
        take: limit,
        include: {
          organization: { select: { id: true, name: true, email: true } },
          subscription: { include: { plan: { select: { name: true } } } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count(),
    ]);
    return { data, total, page, limit };
  }

  async findByOrg(organizationId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { organizationId },
        skip,
        take: limit,
        include: {
          subscription: { include: { plan: { select: { name: true } } } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where: { organizationId } }),
    ]);
    return { data, total, page, limit };
  }

  async markPaid(id: string, dto: MarkPaidDto) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);

    const [payment, updatedInvoice] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          invoiceId: id,
          organizationId: invoice.organizationId,
          amount: dto.amount,
          paymentDate: new Date(dto.paymentDate),
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          recordedById: dto.recordedById,
        },
      }),
      this.prisma.invoice.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: new Date(dto.paymentDate),
        },
      }),
    ]);

    return { payment, invoice: updatedInvoice };
  }

  async voidInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);

    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'VOID' },
    });
  }
}
