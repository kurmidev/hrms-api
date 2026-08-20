import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EmployeeKpiStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QueryKpiDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by designation UUID' })
  @IsOptional()
  @IsString()
  designationId?: string;

  @ApiPropertyOptional({ enum: EmployeeKpiStatus })
  @IsOptional()
  @IsEnum(EmployeeKpiStatus)
  status?: EmployeeKpiStatus;
}
