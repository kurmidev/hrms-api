import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InsuranceEnrollmentStatus } from '@prisma/client';
import { InsurancePolicyResponseDto } from './insurance-policy-response.dto';

export class FamilyMemberResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  relation: string;

  @ApiProperty()
  dateOfBirth: string;
}

export class EnrollmentEmployeeSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  empCode: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional({ nullable: true })
  pfNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  esiNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  uanNumber: string | null;
}

export class EmployeeInsuranceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employeeId: string;

  @ApiPropertyOptional({ type: EnrollmentEmployeeSummaryDto })
  employee?: EnrollmentEmployeeSummaryDto;

  @ApiProperty()
  policyId: string;

  @ApiPropertyOptional({ type: InsurancePolicyResponseDto })
  policy?: InsurancePolicyResponseDto;

  @ApiProperty()
  enrolledAt: Date;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ enum: InsuranceEnrollmentStatus })
  approvalStatus: InsuranceEnrollmentStatus;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: Date | null;

  @ApiPropertyOptional({ type: [FamilyMemberResponseDto], nullable: true })
  familyMembers: FamilyMemberResponseDto[] | null;

  @ApiProperty()
  updatedAt: Date;
}
