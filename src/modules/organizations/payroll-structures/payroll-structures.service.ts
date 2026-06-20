import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { paginate, PaginationDto } from '../../../common/dto/pagination.dto';
import { CreatePayrollStructureDto } from './dto/create-payroll-structure.dto';
import { UpdatePayrollStructureDto } from './dto/update-payroll-structure.dto';
import { SalaryComponentDto } from './dto/salary-component.dto';

@Injectable()
export class PayrollStructuresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreatePayrollStructureDto) {
    this.validateComponents(dto.components);

    return this.prisma.payrollStructure.create({
      data: {
        organizationId,
        name: dto.name,
        components: dto.components as unknown as object,
        isActive: dto.isActive ?? true,
      },
      include: {
        _count: { select: { employees: true, designations: true } },
      },
    });
  }

  async findAll(organizationId: string, pagination: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.payrollStructure.findMany({
        where: { organizationId, deletedAt: null },
        include: { _count: { select: { employees: true, designations: true } } },
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.payrollStructure.count({ where: { organizationId, deletedAt: null } }),
    ]);

    return paginate(
      data.map((s) => this.toResponse(s)),
      total,
      pagination,
    );
  }

  async findOne(organizationId: string, id: string) {
    const structure = await this.prisma.payrollStructure.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        _count: { select: { employees: true, designations: true } },
        designations: {
          where: { deletedAt: null },
          select: { id: true, name: true, level: true, department: { select: { name: true } } },
          orderBy: [{ level: 'asc' }, { name: 'asc' }],
        },
      },
    });
    if (!structure) throw new NotFoundException('Payroll structure not found');

    return {
      ...this.toResponse(structure),
      designations: structure.designations.map((d) => ({
        id: d.id,
        name: d.name,
        departmentName: d.department.name,
        level: d.level,
      })),
    };
  }

  async update(organizationId: string, id: string, dto: UpdatePayrollStructureDto) {
    const structure = await this.prisma.payrollStructure.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!structure) throw new NotFoundException('Payroll structure not found');

    if (dto.components) {
      this.validateComponents(dto.components);
    }

    return this.prisma.payrollStructure.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.components !== undefined && { components: dto.components as unknown as object }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { _count: { select: { employees: true, designations: true } } },
    });
  }

  async remove(organizationId: string, id: string) {
    const structure = await this.prisma.payrollStructure.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { _count: { select: { employees: true } } },
    });
    if (!structure) throw new NotFoundException('Payroll structure not found');

    if (structure._count.employees > 0) {
      throw new BadRequestException(
        `Cannot delete payroll structure — ${structure._count.employees} employee(s) are assigned to it.`,
      );
    }

    await this.prisma.payrollStructure.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true, message: `Payroll structure "${structure.name}" deleted successfully` };
  }

  async restore(organizationId: string, id: string) {
    const structure = await this.prisma.payrollStructure.findFirst({ where: { id, organizationId, deletedAt: { not: null } } });
    if (!structure) throw new NotFoundException('Deleted payroll structure not found');
    return this.prisma.payrollStructure.update({ where: { id }, data: { deletedAt: null } });
  }

  async findTrashed(organizationId: string, pagination: PaginationDto) {
    const where = { organizationId, deletedAt: { not: null } };
    const [data, total] = await Promise.all([
      this.prisma.payrollStructure.findMany({ where, orderBy: { deletedAt: 'desc' }, skip: pagination.skip, take: pagination.limit }),
      this.prisma.payrollStructure.count({ where }),
    ]);
    return paginate(data, total, pagination);
  }

  async assignDesignation(organizationId: string, structureId: string, designationId: string) {
    const structure = await this.prisma.payrollStructure.findFirst({ where: { id: structureId, organizationId, deletedAt: null } });
    if (!structure) throw new NotFoundException('Payroll structure not found');

    const designation = await this.prisma.designation.findFirst({ where: { id: designationId, organizationId, deletedAt: null } });
    if (!designation) throw new NotFoundException('Designation not found');

    return this.prisma.designation.update({
      where: { id: designationId },
      data: { payrollStructureId: structureId },
      include: { department: { select: { name: true } } },
    });
  }

  async unassignDesignation(organizationId: string, structureId: string, designationId: string) {
    const structure = await this.prisma.payrollStructure.findFirst({ where: { id: structureId, organizationId } });
    if (!structure) throw new NotFoundException('Payroll structure not found');

    const designation = await this.prisma.designation.findFirst({
      where: { id: designationId, organizationId, payrollStructureId: structureId },
    });
    if (!designation) throw new NotFoundException('Designation not linked to this payroll structure');

    return this.prisma.designation.update({
      where: { id: designationId },
      data: { payrollStructureId: null },
    });
  }

  async findDesignations(organizationId: string, structureId: string) {
    const structure = await this.prisma.payrollStructure.findFirst({ where: { id: structureId, organizationId, deletedAt: null } });
    if (!structure) throw new NotFoundException('Payroll structure not found');

    return this.prisma.designation.findMany({
      where: { payrollStructureId: structureId, organizationId, deletedAt: null },
      include: { department: { select: { id: true, name: true } } },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  private toResponse(s: {
    id: string;
    organizationId: string;
    name: string;
    components: unknown;
    isActive: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { employees: number; designations: number };
  }) {
    return {
      id: s.id,
      organizationId: s.organizationId,
      name: s.name,
      components: s.components,
      isActive: s.isActive,
      employeeCount: s._count.employees,
      designationCount: s._count.designations,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      deletedAt: s.deletedAt,
    };
  }

  private validateComponents(components: SalaryComponentDto[]) {
    const names = components.map((c) => c.name.toLowerCase());
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      throw new BadRequestException('Component names must be unique within a payroll structure');
    }

    const hasEarning = components.some((c) => !c.isDeductible);
    if (!hasEarning) {
      throw new BadRequestException('At least one earning component (isDeductible = false) is required');
    }

    for (const component of components) {
      if (component.type === 'PERCENTAGE' && (component.value < 0 || component.value > 100)) {
        throw new BadRequestException(`Component "${component.name}": PERCENTAGE type value must be between 0 and 100`);
      }
      if (component.type === 'FIXED' && component.value <= 0) {
        throw new BadRequestException(`Component "${component.name}": FIXED type value must be greater than 0`);
      }
    }
  }
}
