import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { FamilyMemberDto } from './family-member.dto';

export class EnrollInsuranceDto {
  @ApiProperty({ description: 'Employee UUID to enroll' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ description: 'InsurancePolicy UUID' })
  @IsUUID()
  policyId: string;

  @ApiPropertyOptional({ type: [FamilyMemberDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FamilyMemberDto)
  familyMembers?: FamilyMemberDto[];
}
