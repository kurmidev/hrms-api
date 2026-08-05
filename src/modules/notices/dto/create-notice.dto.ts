import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateNoticeDto {
  @ApiProperty({ example: 'Office closed on 15th August' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'The office will remain closed for Independence Day.' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ enum: ['ALL', 'TARGETED'], default: 'ALL' })
  @IsOptional()
  @IsIn(['ALL', 'TARGETED'])
  targetType?: 'ALL' | 'TARGETED';

  @ApiPropertyOptional({ type: [String], description: 'Role UUIDs (TARGETED only)' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetRoles?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Department UUIDs (TARGETED only)' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetDepts?: string[];

  @ApiPropertyOptional({ example: '2026-07-20T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ default: false, description: 'Publish immediately on create' })
  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}
