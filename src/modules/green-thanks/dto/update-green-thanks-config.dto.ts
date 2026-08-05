import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateGreenThanksConfigDto {
  @ApiPropertyOptional({ example: 50, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  inrPerPoint?: number;

  @ApiPropertyOptional({ example: 100, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  quarterlyLimitPoints?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPayrollLinked?: boolean;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}
