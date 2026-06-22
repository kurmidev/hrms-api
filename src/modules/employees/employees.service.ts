import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { EmployeeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PatchEmployeeStatusDto } from './dto/patch-employee-status.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

const VALID_STATUS_TRANSITIONS: Record<EmployeeStatus, EmployeeStatus[]> = {
  [EmployeeStatus.PRE_BOARDING]: [EmployeeStatus.ACTIVE, EmployeeStatus.EXITED],
  [EmployeeStatus.ACTIVE]:       [EmployeeStatus.ON_LEAVE, EmployeeStatus.SUSPENDED, EmployeeStatus.EXITED],
  [EmployeeStatus.ON_LEAVE]:     [EmployeeStatus.ACTIVE, EmployeeStatus.EXITED],
  [EmployeeStatus.SUSPENDED]:    [EmployeeStatus.ACTIVE, EmployeeStatus.EXITED],
  [EmployeeStatus.EXITED]:       [],
};

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateEmployeeDto, createdById: string) {
    const empCode = await this.resolveEmpCode(organizationId, dto.empCode);

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          organizationId,
          empCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          gender: dto.gender ?? null,
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          payrollStructureId: dto.payrollStructureId,
          leavePolicyId: dto.leavePolicyId,
          employmentType: dto.employmentType,
          status: EmployeeStatus.PRE_BOARDING,
          joiningDate: new Date(dto.joiningDate),
          probationEndDate: dto.probationEndDate ? new Date(dto.probationEndDate) : null,
          reportingManagerId: dto.reportingManagerId ?? null,
          pfNumber: dto.pfNumber ?? null,
          esiNumber: dto.esiNumber ?? null,
          uanNumber: dto.uanNumber ?? null,
          createdById,
        },
      });

      // Create user account with temp password
      const digits = Math.floor(1000 + Math.random() * 9000);
      const prefix = dto.firstName.slice(0, 3);
      const tempPassword = `${prefix}@${digits}`;
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      await tx.user.create({
        data: {
          organizationId,
          employeeId: employee.id,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          mustChangePassword: true,
          isActive: true,
        },
      });

      return employee;
    });
  }

  async findAll(organizationId: string, query: EmployeeQueryDto) {
    const where: Prisma.EmployeeWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.departmentId && { departmentId: query.departmentId }),
      ...(query.designationId && { designationId: query.designationId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true, level: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async findOne(organizationId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        department: true,
        designation: true,
        user: { select: { id: true, email: true, isActive: true, mustChangePassword: true, lastLoginAt: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async update(organizationId: string, id: string, dto: UpdateEmployeeDto, updatedById: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.$transaction(async (tx) => {
      return tx.employee.update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
          ...(dto.designationId !== undefined && { designationId: dto.designationId }),
          ...(dto.payrollStructureId !== undefined && { payrollStructureId: dto.payrollStructureId }),
          ...(dto.leavePolicyId !== undefined && { leavePolicyId: dto.leavePolicyId }),
          ...(dto.employmentType !== undefined && { employmentType: dto.employmentType }),
          ...(dto.joiningDate !== undefined && { joiningDate: new Date(dto.joiningDate) }),
          ...(dto.probationEndDate !== undefined && { probationEndDate: new Date(dto.probationEndDate) }),
          ...(dto.reportingManagerId !== undefined && { reportingManagerId: dto.reportingManagerId }),
          ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
          ...(dto.gender !== undefined && { gender: dto.gender }),
          ...(dto.pfNumber !== undefined && { pfNumber: dto.pfNumber }),
          ...(dto.esiNumber !== undefined && { esiNumber: dto.esiNumber }),
          ...(dto.uanNumber !== undefined && { uanNumber: dto.uanNumber }),
          updatedById,
        },
      });
    });
  }

  async patchStatus(organizationId: string, id: string, dto: PatchEmployeeStatusDto, updatedById: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found');

    const allowed = VALID_STATUS_TRANSITIONS[employee.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Transition from ${employee.status} to ${dto.status} is not permitted`);
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.employee.update({ where: { id }, data: { status: dto.status, updatedById } });
    });
  }

  async remove(organizationId: string, id: string, updatedById: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: { deletedAt: new Date(), updatedById } });
      return { deleted: true, message: `Employee ${employee.empCode} deleted successfully` };
    });
  }

  async restore(organizationId: string, id: string, updatedById: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id, organizationId, deletedAt: { not: null } } });
    if (!employee) throw new NotFoundException('Deleted employee not found');

    return this.prisma.$transaction(async (tx) => {
      return tx.employee.update({ where: { id }, data: { deletedAt: null, updatedById } });
    });
  }

  async findTrashed(organizationId: string, query: EmployeeQueryDto) {
    const where: Prisma.EmployeeWhereInput = { organizationId, deletedAt: { not: null } };
    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({ where, orderBy: { deletedAt: 'desc' }, skip: query.skip, take: query.limit }),
      this.prisma.employee.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  private async resolveEmpCode(organizationId: string, customCode?: string): Promise<string> {
    if (customCode) {
      const clash = await this.prisma.employee.findFirst({ where: { organizationId, empCode: customCode } });
      if (clash) throw new ConflictException(`empCode ${customCode} is already in use`);
      return customCode;
    }
    const last = await this.prisma.employee.findFirst({
      where: { organizationId },
      orderBy: { empCode: 'desc' },
      select: { empCode: true },
    });
    const seq = last ? parseInt(last.empCode.replace(/\D/g, ''), 10) + 1 : 1;
    return `EMP-${String(seq).padStart(5, '0')}`;
  }
}
