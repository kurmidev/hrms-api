import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ApproveTodoDto {
  @ApiProperty({ example: true, description: 'true = approve, false = reject' })
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional({ example: 'Quantity does not match delivery logs' })
  @IsOptional()
  @IsString()
  rejectionNote?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Hold the incentive amount instead of releasing it immediately',
  })
  @IsOptional()
  @IsBoolean()
  hold?: boolean;

  @ApiPropertyOptional({ example: 7, minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  payrollMonth?: number;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  payrollYear?: number;
}
