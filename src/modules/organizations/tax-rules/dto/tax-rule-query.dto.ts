import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class TaxRuleQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by tax type (PF, ESI, PT, TDS, or any custom value)' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter statutory rules only' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isStatutory?: boolean;
}
