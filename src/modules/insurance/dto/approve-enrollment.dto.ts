import { ApiProperty } from '@nestjs/swagger';
import { InsuranceEnrollmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ApproveEnrollmentDto {
  @ApiProperty({ enum: [InsuranceEnrollmentStatus.APPROVED, InsuranceEnrollmentStatus.REJECTED] })
  @IsEnum(InsuranceEnrollmentStatus)
  approvalStatus: InsuranceEnrollmentStatus;
}
