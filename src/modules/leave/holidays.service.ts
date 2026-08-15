import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { QueryHolidaysDto } from './dto/query-holidays.dto';

function startOfDay(date: Date | string): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: QueryHolidaysDto) {
    // The frontend's `HolidaysPage.tsx` (leaveApi.getHolidays(year)) always
    // sends `?year=`, but this endpoint previously validated against the bare
    // `PaginationDto` (no `year` field) — with the global ValidationPipe's
    // whitelist mode, that rejected every real call with a 400 ("property
    // year should not exist"), and even without the 400 the service ignored
    // `year` entirely and never filtered by it. Filter using UTC year
    // boundaries, matching the `Date.UTC`-based storage convention fixed for
    // `AttendanceLog`/`OdRecord` (known-issues.md §19) — `Holiday.date` uses
    // the same local-midnight `startOfDay` write path below, so a UTC year
    // range is the safe, unambiguous way to bound it.
    const where: Prisma.HolidayWhereInput = {
      organizationId,
      ...(query.year && {
        date: {
          gte: new Date(Date.UTC(query.year, 0, 1)),
          lt: new Date(Date.UTC(query.year + 1, 0, 1)),
        },
      }),
    };
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
