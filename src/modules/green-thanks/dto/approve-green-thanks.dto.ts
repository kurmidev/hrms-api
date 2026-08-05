import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ApproveGreenThanksDto {
  @ApiProperty({ description: 'true to approve, false to reject' })
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional({ description: 'Required context when rejecting' })
  @IsOptional()
  @IsString()
  rejectionNote?: string;

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
