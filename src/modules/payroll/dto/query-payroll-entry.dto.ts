import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QueryPayrollEntryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter entries by department UUID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Search by employee name or empCode' })
  @IsOptional()
  @IsString()
  search?: string;
}
