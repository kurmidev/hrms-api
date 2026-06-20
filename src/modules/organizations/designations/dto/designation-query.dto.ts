import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class DesignationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter designations by department' })
  @IsString()
  @IsOptional()
  departmentId?: string;
}
