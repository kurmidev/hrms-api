import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QueryRatingDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by ratee employee UUID' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
