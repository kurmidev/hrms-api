import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { AssetStatus } from '@prisma/client';

export class QueryAssetDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by asset type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ enum: AssetStatus })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;
}
