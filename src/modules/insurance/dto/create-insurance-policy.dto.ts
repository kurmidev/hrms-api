import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InsuranceType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateInsurancePolicyDto {
  @ApiProperty({ example: 'Group Health Cover 2026' })
  @IsString()
  @MaxLength(191)
  name: string;

  @ApiProperty({ example: 'Star Health' })
  @IsString()
  @MaxLength(191)
  provider: string;

  @ApiProperty({ example: 'SH-2026-001' })
  @IsString()
  @MaxLength(191)
  policyNumber: string;

  @ApiProperty({ enum: InsuranceType })
  @IsEnum(InsuranceType)
  type: InsuranceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  coverageAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  premium?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  renewalDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  documentUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
