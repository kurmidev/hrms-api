import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QueryPerformanceCycleDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'CLOSED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'CLOSED'])
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED';

  @ApiPropertyOptional({ description: 'Search by cycle name (contains)' })
  @IsOptional()
  @IsString()
  search?: string;
}
