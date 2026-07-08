import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDashboardWidgetDto {
  @IsString()
  widgetType: string;

  @IsString()
  title: string;

  @IsNumber()
  position: number;

  @IsOptional()
  @IsNumber()
  colSpan?: number;

  @IsOptional()
  @IsNumber()
  rowSpan?: number;

  @IsOptional()
  config?: Record<string, any>;
}

export class CreateDashboardDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  roleName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDashboardWidgetDto)
  widgets?: CreateDashboardWidgetDto[];
}
