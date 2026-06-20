import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaginationDto, paginate } from '../../../common/dto/pagination.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { MoveDepartmentDto } from './dto/move-department.dto';
import { DepartmentTreeNodeDto } from './dto/department-response.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateDepartmentDto) {
    const duplicate = await this.prisma.department.findFirst({
      where: { organizationId, name: dto.name, deletedAt: null },
    });
    if (duplicate) throw new ConflictException(`Department "${dto.name}" already exists in this organization`);

    let hierarchyLevel = 0;
    if (dto.parentId) {
      const parent = await this.verifyDeptBelongsToOrg(dto.parentId, organizationId, 'Parent department not found in this organization');
      hierarchyLevel = parent.hierarchyLevel + 1;
    }

    if (dto.headEmployeeId) {
      const emp = await this.prisma.employee.findFirst({ where: { id: dto.headEmployeeId, organizationId } });
      if (!emp) throw new BadRequestException('Head employee not found in this organization');
    }

    return this.prisma.department.create({
      data: {
        organizationId,
        name: dto.name,
        parentId: dto.parentId ?? null,
        headEmployeeId: dto.headEmployeeId ?? null,
        hierarchyLevel,
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { employees: true, children: true } },
      },
    });
  }

  async findAll(organizationId: string, pagination: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.department.findMany({
        where: { organizationId, deletedAt: null },
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { employees: true, children: true } },
        },
        orderBy: [{ hierarchyLevel: 'asc' }, { name: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.department.count({ where: { organizationId, deletedAt: null } }),
    ]);

    return paginate(
      data.map((d) => ({
        id: d.id,
        organizationId: d.organizationId,
        name: d.name,
        parentId: d.parentId,
        headEmployeeId: d.headEmployeeId,
        hierarchyLevel: d.hierarchyLevel,
        parent: d.parent,
        employeeCount: d._count.employees,
        childrenCount: d._count.children,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        deletedAt: d.deletedAt,
      })),
      total,
      pagination,
    );
  }

  async findTree(organizationId: string): Promise<DepartmentTreeNodeDto[]> {
    const all = await this.prisma.department.findMany({
      where: { organizationId, deletedAt: null },
      include: { _count: { select: { employees: true } } },
      orderBy: [{ hierarchyLevel: 'asc' }, { name: 'asc' }],
    });

    const map = new Map<string, DepartmentTreeNodeDto>();
    for (const d of all) {
      map.set(d.id, {
        id: d.id,
        organizationId: d.organizationId,
        name: d.name,
        parentId: d.parentId,
        headEmployeeId: d.headEmployeeId,
        hierarchyLevel: d.hierarchyLevel,
        employeeCount: d._count.employees,
        children: [],
      });
    }

    const roots: DepartmentTreeNodeDto[] = [];
    for (const d of all) {
      const node = map.get(d.id)!;
      if (d.parentId && map.has(d.parentId)) {
        map.get(d.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async findOne(organizationId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { employees: true, children: true } },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');

    return {
      id: dept.id,
      organizationId: dept.organizationId,
      name: dept.name,
      parentId: dept.parentId,
      headEmployeeId: dept.headEmployeeId,
      hierarchyLevel: dept.hierarchyLevel,
      parent: dept.parent,
      employeeCount: dept._count.employees,
      childrenCount: dept._count.children,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
      deletedAt: dept.deletedAt,
    };
  }

  async update(organizationId: string, id: string, dto: UpdateDepartmentDto) {
    const dept = await this.prisma.department.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!dept) throw new NotFoundException('Department not found');

    if (dto.name && dto.name !== dept.name) {
      const duplicate = await this.prisma.department.findFirst({
        where: { organizationId, name: dto.name, id: { not: id }, deletedAt: null },
      });
      if (duplicate) throw new ConflictException(`Department "${dto.name}" already exists in this organization`);
    }

    let hierarchyLevel = dept.hierarchyLevel;
    if (dto.parentId !== undefined) {
      await this.validateParentChange(id, dto.parentId, organizationId);
      if (dto.parentId) {
        const parent = await this.prisma.department.findFirst({ where: { id: dto.parentId } });
        hierarchyLevel = (parent?.hierarchyLevel ?? 0) + 1;
      } else {
        hierarchyLevel = 0;
      }
    }

    if (dto.headEmployeeId) {
      const emp = await this.prisma.employee.findFirst({ where: { id: dto.headEmployeeId, organizationId } });
      if (!emp) throw new BadRequestException('Head employee not found in this organization');
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId ?? null, hierarchyLevel }),
        ...(dto.headEmployeeId !== undefined && { headEmployeeId: dto.headEmployeeId ?? null }),
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { employees: true, children: true } },
      },
    });

    if (dto.parentId !== undefined) {
      await this.cascadeHierarchyLevels(id, hierarchyLevel);
    }

    return updated;
  }

  async move(organizationId: string, id: string, dto: MoveDepartmentDto) {
    const dept = await this.prisma.department.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!dept) throw new NotFoundException('Department not found');

    const newParentId = dto.newParentId ?? null;
    if (newParentId) {
      await this.validateParentChange(id, newParentId, organizationId);
    }

    let newLevel = 0;
    if (newParentId) {
      const parent = await this.prisma.department.findFirst({ where: { id: newParentId } });
      newLevel = (parent?.hierarchyLevel ?? 0) + 1;
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: { parentId: newParentId, hierarchyLevel: newLevel },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { employees: true, children: true } },
      },
    });

    await this.cascadeHierarchyLevels(id, newLevel);

    return updated;
  }

  async remove(organizationId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        _count: {
          select: {
            employees: true,
            children: { where: { deletedAt: null } },
            designations: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');

    if (dept._count.employees > 0) {
      throw new BadRequestException(
        `Cannot delete department — ${dept._count.employees} employee(s) are assigned to it. Reassign them first.`,
      );
    }
    if (dept._count.children > 0) {
      throw new BadRequestException(
        `Cannot delete department — it has ${dept._count.children} active sub-department(s). Delete or re-parent them first.`,
      );
    }
    if (dept._count.designations > 0) {
      throw new BadRequestException(
        `Cannot delete department — it has ${dept._count.designations} active designation(s). Delete them first.`,
      );
    }

    await this.prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true, message: `Department "${dept.name}" deleted successfully` };
  }

  async restore(organizationId: string, id: string) {
    const dept = await this.prisma.department.findFirst({ where: { id, organizationId, deletedAt: { not: null } } });
    if (!dept) throw new NotFoundException('Deleted department not found');
    return this.prisma.department.update({ where: { id }, data: { deletedAt: null } });
  }

  async findTrashed(organizationId: string, pagination: PaginationDto) {
    const where = { organizationId, deletedAt: { not: null } };
    const [data, total] = await Promise.all([
      this.prisma.department.findMany({ where, orderBy: { deletedAt: 'desc' }, skip: pagination.skip, take: pagination.limit }),
      this.prisma.department.count({ where }),
    ]);
    return paginate(data, total, pagination);
  }

  private async verifyDeptBelongsToOrg(deptId: string, organizationId: string, errorMessage: string) {
    const dept = await this.prisma.department.findFirst({ where: { id: deptId, organizationId, deletedAt: null } });
    if (!dept) throw new BadRequestException(errorMessage);
    return dept;
  }

  private async validateParentChange(id: string, newParentId: string | null | undefined, organizationId: string) {
    if (!newParentId) return;
    if (newParentId === id) {
      throw new BadRequestException('A department cannot be its own parent');
    }
    await this.verifyDeptBelongsToOrg(newParentId, organizationId, 'Parent department not found in this organization');
    await this.checkCircularReference(id, newParentId);
  }

  private async checkCircularReference(id: string, proposedParentId: string) {
    let currentId: string | null = proposedParentId;
    while (currentId) {
      if (currentId === id) {
        throw new BadRequestException('Circular department hierarchy detected — a department cannot be a descendant of itself');
      }
      const parent = await this.prisma.department.findUnique({ where: { id: currentId }, select: { parentId: true } });
      currentId = parent?.parentId ?? null;
    }
  }

  private async cascadeHierarchyLevels(parentId: string, parentLevel: number) {
    const children = await this.prisma.department.findMany({ where: { parentId, deletedAt: null }, select: { id: true } });
    for (const child of children) {
      await this.prisma.department.update({ where: { id: child.id }, data: { hierarchyLevel: parentLevel + 1 } });
      await this.cascadeHierarchyLevels(child.id, parentLevel + 1);
    }
  }
}
