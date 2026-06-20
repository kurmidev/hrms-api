import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { paginate, PaginationDto } from '../../../common/dto/pagination.dto';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { DesignationQueryDto } from './dto/designation-query.dto';

@Injectable()
export class DesignationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateDesignationDto) {
    await this.verifyDeptBelongsToOrg(dto.departmentId, organizationId);

    if (dto.payrollStructureId) {
      await this.verifyPayrollStructure(dto.payrollStructureId, organizationId);
    }

    return this.prisma.designation.create({
      data: {
        organizationId,
        departmentId: dto.departmentId,
        name: dto.name,
        level: dto.level ?? 0,
        payrollStructureId: dto.payrollStructureId ?? null,
      },
      include: {
        department: { select: { id: true, name: true } },
        payrollStructure: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
  }

  async findAll(organizationId: string, query: DesignationQueryDto) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(query.departmentId && { departmentId: query.departmentId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.designation.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          payrollStructure: { select: { id: true, name: true } },
          _count: { select: { employees: true } },
        },
        orderBy: [{ department: { name: 'asc' } }, { level: 'asc' }, { name: 'asc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.designation.count({ where }),
    ]);

    return paginate(
      data.map((d) => this.toResponse(d)),
      total,
      query,
    );
  }

  async findForAssignment(organizationId: string) {
    const data = await this.prisma.designation.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        department: { select: { id: true, name: true, hierarchyLevel: true } },
        payrollStructure: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: [{ department: { hierarchyLevel: 'asc' } }, { department: { name: 'asc' } }, { level: 'asc' }, { name: 'asc' }],
    });
    return data.map((d) => this.toResponse(d));
  }

  async findOne(organizationId: string, id: string) {
    const designation = await this.prisma.designation.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        department: { select: { id: true, name: true } },
        payrollStructure: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
    if (!designation) throw new NotFoundException('Designation not found');
    return this.toResponse(designation);
  }

  async update(organizationId: string, id: string, dto: UpdateDesignationDto) {
    const designation = await this.prisma.designation.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!designation) throw new NotFoundException('Designation not found');

    if (dto.departmentId && dto.departmentId !== designation.departmentId) {
      await this.verifyDeptBelongsToOrg(dto.departmentId, organizationId);
    }

    if (dto.payrollStructureId !== undefined && dto.payrollStructureId !== null) {
      await this.verifyPayrollStructure(dto.payrollStructureId, organizationId);
    }

    return this.prisma.designation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.level !== undefined && { level: dto.level }),
        ...(dto.payrollStructureId !== undefined && { payrollStructureId: dto.payrollStructureId ?? null }),
      },
      include: {
        department: { select: { id: true, name: true } },
        payrollStructure: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const designation = await this.prisma.designation.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { _count: { select: { employees: true } } },
    });
    if (!designation) throw new NotFoundException('Designation not found');

    if (designation._count.employees > 0) {
      throw new BadRequestException(
        `Cannot delete designation — ${designation._count.employees} employee(s) are currently assigned to it.`,
      );
    }

    await this.prisma.designation.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true, message: `Designation "${designation.name}" deleted successfully` };
  }

  async restore(organizationId: string, id: string) {
    const designation = await this.prisma.designation.findFirst({ where: { id, organizationId, deletedAt: { not: null } } });
    if (!designation) throw new NotFoundException('Deleted designation not found');
    return this.prisma.designation.update({ where: { id }, data: { deletedAt: null } });
  }

  async findTrashed(organizationId: string, pagination: PaginationDto) {
    const where = { organizationId, deletedAt: { not: null } };
    const [data, total] = await Promise.all([
      this.prisma.designation.findMany({ where, orderBy: { deletedAt: 'desc' }, skip: pagination.skip, take: pagination.limit }),
      this.prisma.designation.count({ where }),
    ]);
    return paginate(data, total, pagination);
  }

  private toResponse(d: {
    id: string;
    organizationId: string;
    departmentId: string;
    name: string;
    level: number;
    payrollStructureId: string | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    department: { name: string };
    payrollStructure?: { name: string } | null;
    _count: { employees: number };
  }) {
    return {
      id: d.id,
      organizationId: d.organizationId,
      departmentId: d.departmentId,
      departmentName: d.department.name,
      name: d.name,
      level: d.level,
      payrollStructureId: d.payrollStructureId,
      payrollStructureName: d.payrollStructure?.name ?? null,
      employeeCount: d._count.employees,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      deletedAt: d.deletedAt,
    };
  }

  private async verifyDeptBelongsToOrg(departmentId: string, organizationId: string) {
    const dept = await this.prisma.department.findFirst({ where: { id: departmentId, organizationId, deletedAt: null } });
    if (!dept) throw new BadRequestException('Department not found in this organization');
    return dept;
  }

  private async verifyPayrollStructure(payrollStructureId: string, organizationId: string) {
    const ps = await this.prisma.payrollStructure.findFirst({ where: { id: payrollStructureId, organizationId, deletedAt: null } });
    if (!ps) throw new BadRequestException('Payroll structure not found in this organization');
    return ps;
  }
}
