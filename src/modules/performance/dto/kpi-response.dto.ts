import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeKpiStatus } from '@prisma/client';

export class KpiResponseDto {
  @ApiProperty({ description: 'EmployeeKpi assignment id' })
  id: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  employeeName: string;

  @ApiProperty()
  designationId: string;

  @ApiProperty()
  designationName: string;

  @ApiProperty()
  kpiTitle: string;

  @ApiPropertyOptional({ nullable: true })
  targetValue: number | null;

  @ApiPropertyOptional({ nullable: true })
  unit: string | null;

  @ApiPropertyOptional({ nullable: true })
  achievedValue: number | null;

  @ApiProperty({ enum: EmployeeKpiStatus })
  status: EmployeeKpiStatus;
}
