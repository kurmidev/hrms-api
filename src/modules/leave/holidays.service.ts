import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, PaginationDto } from '@common/dto/pagination.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

function startOfDay(date: Date | string): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: PaginationDto) {
    const where = { organizationId };
    const [data, total] = await Promise.all([
      this.prisma.holiday.findMany({
        where,
        orderBy: { date: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.holiday.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async create(organizationId: string, dto: CreateHolidayDto) {
    return this.prisma.holiday.create({
      data: {
        organizationId,
        name: dto.name,
        date: startOfDay(dto.date),
        type: dto.type ?? 'national',
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateHolidayDto) {
    const holiday = await this.prisma.holiday.findFirst({ where: { id, organizationId } });
    if (!holiday) throw new NotFoundException('Holiday not found');

    return this.prisma.holiday.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.date !== undefined && { date: startOfDay(dto.date) }),
        ...(dto.type !== undefined && { type: dto.type }),
      },
    });
  }

  async delete(organizationId: string, id: string) {
    const holiday = await this.prisma.holiday.findFirst({ where: { id, organizationId } });
    if (!holiday) throw new NotFoundException('Holiday not found');

    await this.prisma.holiday.delete({ where: { id } });
    return { deleted: true, message: `Holiday "${holiday.name}" deleted successfully` };
  }

  async isHoliday(organizationId: string, date: Date | string): Promise<boolean> {
    const count = await this.prisma.holiday.count({
      where: { organizationId, date: startOfDay(date) },
    });
    return count > 0;
  }
}
