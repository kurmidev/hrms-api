import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QueryGlobalLeaveDto extends PaginationDto {
  @ApiPropertyOptional({ example: 2026, description: 'Filter by calendar year of the date field' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}
