import { ApiPropertyOptional } from '@nestjs/swagger';
import { InsuranceEnrollmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QueryEnrollmentDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by employee UUID' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter by InsurancePolicy UUID' })
  @IsOptional()
  @IsUUID()
  policyId?: string;

  @ApiPropertyOptional({ enum: InsuranceEnrollmentStatus })
  @IsOptional()
  @IsEnum(InsuranceEnrollmentStatus)
  approvalStatus?: InsuranceEnrollmentStatus;
}
