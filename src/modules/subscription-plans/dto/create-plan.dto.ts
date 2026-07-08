import { IsString, IsNumber, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  maxEmployees: number;

  @IsNumber()
  priceMonthly: number;

  @IsNumber()
  priceQuarterly: number;

  @IsNumber()
  priceYearly: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
