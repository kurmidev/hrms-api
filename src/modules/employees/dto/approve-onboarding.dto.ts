import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EmploymentType } from '@prisma/client';

export class ApproveOnboardingDto {
  @ApiProperty({ description: 'Department UUID' })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ description: 'Designation UUID (must belong to the given department)' })
  @IsUUID()
  designationId: string;

  @ApiProperty({ description: 'One or more role UUIDs to assign', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  roleIds: string[];

  @ApiProperty({ description: 'Payroll structure UUID' })
  @IsUUID()
  payrollStructureId: string;

  @ApiProperty({ description: 'Leave policy UUID (must be active)' })
  @IsUUID()
  leavePolicyId: string;

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @ApiProperty({ example: '2026-07-01', description: 'ISO date string for joining date' })
  @IsDateString()
  joiningDate: string;

  @ApiPropertyOptional({ description: 'Reporting manager employee UUID' })
  @IsUUID()
  @IsOptional()
  reportingManagerId?: string;

  @ApiPropertyOptional({ description: 'Custom employee code — auto-generated if omitted' })
  @IsString()
  @IsOptional()
  empCode?: string;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'Probation end date' })
  @IsDateString()
  @IsOptional()
  probationEndDate?: string;
}
