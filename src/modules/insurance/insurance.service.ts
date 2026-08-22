import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { CreateInsurancePolicyDto } from './dto/create-insurance-policy.dto';
import { UpdateInsurancePolicyDto } from './dto/update-insurance-policy.dto';
import { QueryInsurancePolicyDto } from './dto/query-insurance-policy.dto';
import { EnrollInsuranceDto } from './dto/enroll-insurance.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { ApproveEnrollmentDto } from './dto/approve-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';

const ENROLLMENT_WITH_RELATIONS = {
  employee: {
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      pfNumber: true,
      esiNumber: true,
      uanNumber: true,
    },
  },
  policy: true,
} satisfies Prisma.EmployeeInsuranceInclude;

type EnrollmentWithRelations = Prisma.EmployeeInsuranceGetPayload<{
  include: typeof ENROLLMENT_WITH_RELATIONS;
}>;

@Injectable()
export class InsuranceService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Policies ───────────────────────────────────────────────────────────────

  async createPolicy(organizationId: string, dto: CreateInsurancePolicyDto) {
    const policy = await this.prisma.insurancePolicy.create({
      data: {
        organizationId,
        name: dto.name,
        provider: dto.provider,
        policyNumber: dto.policyNumber,
        type: dto.type,
        coverageAmount: dto.coverageAmount,
        premium: dto.premium,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null,
        documentUrl: dto.documentUrl,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toPolicyResponse(policy);
  }

  async listPolicies(organizationId: string, query: QueryInsurancePolicyDto) {
    const where: Prisma.InsurancePolicyWhereInput = {
      organizationId,
      ...(query.type && { type: query.type }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.insurancePolicy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.insurancePolicy.count({ where }),
    ]);

    return paginate(
      data.map((policy) => this.toPolicyResponse(policy)),
      total,
      query,
    );
  }

  async getPolicy(organizationId: string, id: string) {
    const policy = await this.getPolicyOrThrow(organizationId, id);
    return this.toPolicyResponse(policy);
  }

  async updatePolicy(organizationId: string, id: string, dto: UpdateInsurancePolicyDto) {
    await this.getPolicyOrThrow(organizationId, id);

    const updated = await this.prisma.insurancePolicy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.provider !== undefined && { provider: dto.provider }),
        ...(dto.policyNumber !== undefined && { policyNumber: dto.policyNumber }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.coverageAmount !== undefined && { coverageAmount: dto.coverageAmount }),
        ...(dto.premium !== undefined && { premium: dto.premium }),
        ...(dto.validFrom !== undefined && {
          validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        }),
        ...(dto.validTo !== undefined && { validTo: dto.validTo ? new Date(dto.validTo) : null }),
        ...(dto.renewalDate !== undefined && {
          renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null,
        }),
        ...(dto.documentUrl !== undefined && { documentUrl: dto.documentUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.toPolicyResponse(updated);
  }

  // ─── Enrollments ────────────────────────────────────────────────────────────

  async enroll(organizationId: string, dto: EnrollInsuranceDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const policy = await this.getPolicyOrThrow(organizationId, dto.policyId);

    const existing = await this.prisma.employeeInsurance.findUnique({
      where: { employeeId_policyId: { employeeId: dto.employeeId, policyId: policy.id } },
    });
    if (existing) {
      throw new ConflictException('Employee is already enrolled in this policy');
    }

    const enrollment = await this.prisma.employeeInsurance.create({
      data: {
        employeeId: dto.employeeId,
        policyId: policy.id,
        familyMembers: dto.familyMembers as unknown as Prisma.InputJsonValue,
      },
      include: ENROLLMENT_WITH_RELATIONS,
    });

    return this.toEnrollmentResponse(enrollment);
  }

  async listEnrollments(organizationId: string, query: QueryEnrollmentDto) {
    const where: Prisma.EmployeeInsuranceWhereInput = {
      employee: { organizationId, deletedAt: null },
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.policyId && { policyId: query.policyId }),
      ...(query.approvalStatus && { approvalStatus: query.approvalStatus }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.employeeInsurance.findMany({
        where,
        include: ENROLLMENT_WITH_RELATIONS,
        orderBy: { enrolledAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.employeeInsurance.count({ where }),
    ]);

    return paginate(
      data.map((enrollment) => this.toEnrollmentResponse(enrollment)),
      total,
      query,
    );
  }

  async getEnrollment(organizationId: string, id: string) {
    const enrollment = await this.getEnrollmentOrThrow(organizationId, id);
    return this.toEnrollmentResponse(enrollment);
  }

  async updateEnrollment(organizationId: string, id: string, dto: UpdateEnrollmentDto) {
    await this.getEnrollmentOrThrow(organizationId, id);

    const updated = await this.prisma.employeeInsurance.update({
      where: { id },
      data: {
        ...(dto.familyMembers !== undefined && {
          familyMembers: dto.familyMembers as unknown as Prisma.InputJsonValue,
        }),
      },
      include: ENROLLMENT_WITH_RELATIONS,
    });

    return this.toEnrollmentResponse(updated);
  }

  async approveEnrollment(
    organizationId: string,
    userId: string,
    approverEmployeeId: string | null,
    id: string,
    dto: ApproveEnrollmentDto,
  ) {
    const enrollment = await this.getEnrollmentOrThrow(organizationId, id);
    if (approverEmployeeId && enrollment.employeeId === approverEmployeeId) {
      throw new ForbiddenException('You cannot approve or reject your own insurance enrollment');
    }

    const updated = await this.prisma.employeeInsurance.update({
      where: { id },
      data: {
        approvalStatus: dto.approvalStatus,
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: ENROLLMENT_WITH_RELATIONS,
    });

    return this.toEnrollmentResponse(updated);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async getPolicyOrThrow(organizationId: string, id: string) {
    const policy = await this.prisma.insurancePolicy.findFirst({ where: { id, organizationId } });
    if (!policy) throw new NotFoundException('Insurance policy not found');
    return policy;
  }

  private async getEnrollmentOrThrow(
    organizationId: string,
    id: string,
  ): Promise<EnrollmentWithRelations> {
    const enrollment = await this.prisma.employeeInsurance.findFirst({
      where: { id, employee: { organizationId, deletedAt: null } },
      include: ENROLLMENT_WITH_RELATIONS,
    });
    if (!enrollment) throw new NotFoundException('Insurance enrollment not found');
    return enrollment;
  }

  private toPolicyResponse(policy: {
    id: string;
    organizationId: string;
    name: string;
    provider: string;
    policyNumber: string;
    type: string;
    coverageAmount: number | null;
    premium: number | null;
    validFrom: Date | null;
    validTo: Date | null;
    renewalDate: Date | null;
    documentUrl: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: policy.id,
      organizationId: policy.organizationId,
      name: policy.name,
      provider: policy.provider,
      policyNumber: policy.policyNumber,
      type: policy.type,
      coverageAmount: policy.coverageAmount,
      premium: policy.premium,
      validFrom: policy.validFrom,
      validTo: policy.validTo,
      renewalDate: policy.renewalDate,
      documentUrl: policy.documentUrl,
      isActive: policy.isActive,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
  }

  private toEnrollmentResponse(enrollment: EnrollmentWithRelations) {
    return {
      id: enrollment.id,
      employeeId: enrollment.employeeId,
      employee: {
        id: enrollment.employee.id,
        empCode: enrollment.employee.empCode,
        firstName: enrollment.employee.firstName,
        lastName: enrollment.employee.lastName,
        pfNumber: enrollment.employee.pfNumber,
        esiNumber: enrollment.employee.esiNumber,
        uanNumber: enrollment.employee.uanNumber,
      },
      policyId: enrollment.policyId,
      policy: this.toPolicyResponse(enrollment.policy),
      enrolledAt: enrollment.enrolledAt,
      status: enrollment.status,
      approvalStatus: enrollment.approvalStatus,
      approvedBy: enrollment.approvedBy,
      approvedAt: enrollment.approvedAt,
      familyMembers: enrollment.familyMembers as unknown as
        | { name: string; relation: string; dateOfBirth: string }[]
        | null,
      updatedAt: enrollment.updatedAt,
    };
  }
}
