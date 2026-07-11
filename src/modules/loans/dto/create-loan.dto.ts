import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateLoanDto {
  @ApiProperty({ example: 50000, description: 'Requested loan amount (must be > 0)' })
  @IsNumber()
  @IsPositive()
  amountRequested: number;

  @ApiProperty({ example: 12, minimum: 1, maximum: 120, description: 'Requested tenure in months' })
  @IsInt()
  @Min(1)
  @Max(120)
  tenureMonths: number;

  @ApiPropertyOptional({ example: 'Medical emergency' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description:
      'Employee UUID to apply on behalf of (managers only). Defaults to the caller’s own employee record.',
  })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
