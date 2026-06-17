import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findFirst({
      where: { organizationId, name: dto.name },
    });
    if (existing) throw new ConflictException(`Role "${dto.name}" already exists in this organization`);

    return this.prisma.role.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions,
      },
    });
  }

  async findAll(organizationId: string) {
    const roles = await this.prisma.role.findMany({
      where: { organizationId },
      include: { _count: { select: { userRoles: true } } },
      orderBy: [{ isSystemRole: 'desc' }, { name: 'asc' }],
    });

    return roles.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      name: r.name,
      description: r.description,
      permissions: r.permissions as string[],
      isSystemRole: r.isSystemRole,
      userCount: r._count.userRoles,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findOne(organizationId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { userRoles: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');

    return {
      id: role.id,
      organizationId: role.organizationId,
      name: role.name,
      description: role.description,
      permissions: role.permissions as string[],
      isSystemRole: role.isSystemRole,
      userCount: role._count.userRoles,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async update(organizationId: string, id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({ where: { id, organizationId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystemRole) throw new ForbiddenException('System roles cannot be modified');

    if (dto.name && dto.name !== role.name) {
      const duplicate = await this.prisma.role.findFirst({
        where: { organizationId, name: dto.name, id: { not: id } },
      });
      if (duplicate) throw new ConflictException(`Role "${dto.name}" already exists`);
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions && { permissions: dto.permissions }),
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { userRoles: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystemRole) throw new ForbiddenException('System roles cannot be deleted');
    if (role._count.userRoles > 0) {
      throw new BadRequestException(
        `Cannot delete role — ${role._count.userRoles} user(s) are assigned to it. Remove all assignments first.`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
    return { deleted: true, message: `Role "${role.name}" deleted successfully` };
  }

  async assignRole(organizationId: string, dto: AssignRoleDto) {
    const [user, role] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: dto.userId, organizationId } }),
      this.prisma.role.findFirst({ where: { id: dto.roleId, organizationId } }),
    ]);

    if (!user) throw new NotFoundException('User not found in this organization');
    if (!role) throw new NotFoundException('Role not found in this organization');

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId: dto.userId, roleId: dto.roleId } },
      create: { userId: dto.userId, roleId: dto.roleId },
      update: {},
    });

    return { assigned: true, message: `Role "${role.name}" assigned to user` };
  }

  async removeRole(organizationId: string, userId: string, roleId: string) {
    const assignment = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
        user: { organizationId },
      },
    });
    if (!assignment) throw new NotFoundException('Role assignment not found');

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });

    return { removed: true, message: 'Role removed from user' };
  }

  async getUserRoles(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!user) throw new NotFoundException('User not found in this organization');

    const assignments = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    return assignments.map((a) => ({
      id: a.role.id,
      name: a.role.name,
      description: a.role.description,
      permissions: a.role.permissions as string[],
      isSystemRole: a.role.isSystemRole,
      assignedAt: a.createdAt,
    }));
  }
}
