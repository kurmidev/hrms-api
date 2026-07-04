import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class PatchEmployeeStatusDto {
  @ApiProperty({ enum: EmployeeStatus })
  @IsEnum(EmployeeStatus)
  status: EmployeeStatus;

  @ApiPropertyOptional({ description: 'Required when transitioning to SUSPENDED or EXITED', example: 'Voluntary resignation' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
