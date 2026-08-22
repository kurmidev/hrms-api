import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GlobalLeaveItemDto {
  @ApiProperty({ example: 'Regional Festival' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: '2026-10-20' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    default: false,
    description: 'When true, applies to every employee regardless of zone',
  })
  @IsOptional()
  @IsBoolean()
  appliesToAll?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Zone UUIDs this leave applies to. Ignored when appliesToAll is true.',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  zoneIds?: string[];
}
