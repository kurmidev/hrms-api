import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EmploymentType } from '@prisma/client';

export enum TaxCalculationType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
  SLAB_BASED = 'SLAB_BASED',
}

export enum TaxApplicableOn {
  GROSS = 'GROSS',
  BASIC = 'BASIC',
  NET = 'NET',
  CUSTOM = 'CUSTOM',
}

export class TaxSlabDto {
  @ApiProperty({ example: 0 }) @IsNumber() @Min(0) fromAmount: number;
  @ApiProperty({ example: 250000, nullable: true }) @IsNumber() @Min(0) @IsOptional() toAmount?: number;
  @ApiPropertyOptional({ example: 10 }) @IsNumber() @Min(0) @IsOptional() rate?: number;
  @ApiPropertyOptional({ example: 500 }) @IsNumber() @Min(0) @IsOptional() fixedAmount?: number;
}

export class ApplicabilityRulesDto {
  @ApiPropertyOptional({ enum: EmploymentType, isArray: true })
  @IsEnum(EmploymentType, { each: true })
  @IsOptional()
  employmentTypes?: EmploymentType[];

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  designationLevelMin?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  designationLevelMax?: number;

  @ApiPropertyOptional({ example: 15000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryCeiling?: number;
}

export class CreateTaxRuleDto {
  @ApiProperty({ example: 'PF Rule FY 2025-26' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'PF', description: 'Short identifier (e.g. PF, ESI, STATE_CESS)' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  code?: string;

  @ApiProperty({ example: 'PF', description: 'User-defined tax category (PF, ESI, PT, TDS, or any custom value)' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  type: string;

  @ApiProperty({ enum: TaxCalculationType, default: TaxCalculationType.PERCENTAGE })
  @IsEnum(TaxCalculationType)
  calculationType: TaxCalculationType;

  @ApiProperty({ enum: TaxApplicableOn, default: TaxApplicableOn.GROSS })
  @IsEnum(TaxApplicableOn)
  applicableOn: TaxApplicableOn;

  @ApiPropertyOptional({ default: false, description: 'Mark true for statutory deductions like PF, ESI, PT, TDS' })
  @IsBoolean()
  @IsOptional()
  isStatutory?: boolean;

  @ApiProperty({
    description:
      'Calculation config. PERCENTAGE: { rate, employeeSplit?, employerSplit? }. FIXED: { amount }. SLAB_BASED: { slabs: [{fromAmount, toAmount?, rate?, fixedAmount?}] }',
    example: { rate: 12, employeeSplit: 12, employerSplit: 13 },
  })
  @IsObject()
  config: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Restrict applicability by employment type, designation level range, or salary ceiling',
  })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicabilityRulesDto)
  applicabilityRules?: ApplicabilityRulesDto;

  @ApiProperty({ example: '2025-04-01' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-03-31', nullable: true })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTaxRuleDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(20) code?: string;
  @ApiPropertyOptional({ enum: TaxCalculationType }) @IsEnum(TaxCalculationType) @IsOptional() calculationType?: TaxCalculationType;
  @ApiPropertyOptional({ enum: TaxApplicableOn }) @IsEnum(TaxApplicableOn) @IsOptional() applicableOn?: TaxApplicableOn;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isStatutory?: boolean;
  @ApiPropertyOptional() @IsObject() @IsOptional() config?: Record<string, unknown>;
  @ApiPropertyOptional() @IsObject() @IsOptional() applicabilityRules?: ApplicabilityRulesDto;
  @ApiPropertyOptional() @IsDateString() @IsOptional() effectiveTo?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

export class SlabTaxConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxSlabDto)
  slabs: TaxSlabDto[];
}
