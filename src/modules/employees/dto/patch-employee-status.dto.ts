import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class PatchEmployeeStatusDto {
  @ApiProperty({ enum: EmployeeStatus })
  @IsEnum(EmployeeStatus)
  status: EmployeeStatus;
}
