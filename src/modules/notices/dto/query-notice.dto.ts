import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QueryNoticeDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['board', 'manage'], default: 'board' })
  @IsOptional()
  @IsIn(['board', 'manage'])
  view?: 'board' | 'manage';

  @ApiPropertyOptional({ enum: ['draft', 'scheduled', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'scheduled', 'published'])
  status?: 'draft' | 'scheduled' | 'published';
}
