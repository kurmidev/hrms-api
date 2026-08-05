import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetStatus } from '@prisma/client';

export class ReturnAssetDto {
  @ApiPropertyOptional({ example: 'Minor scratches on the lid' })
  @IsOptional()
  @IsString()
  conditionOnReturn?: string;

  @ApiPropertyOptional({
    enum: AssetStatus,
    default: AssetStatus.AVAILABLE,
    description: 'Status to set the asset to after return (defaults to AVAILABLE)',
  })
  @IsOptional()
  @IsEnum(AssetStatus)
  newStatus?: AssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
