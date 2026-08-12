import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QueryOdDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by employee ID (attendance:read only)' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'ISO date (YYYY-MM-DD) to filter a single day' })
  @IsOptional()
  @IsString()
  date?: string;
}
