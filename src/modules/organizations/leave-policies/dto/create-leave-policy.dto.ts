import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export { LeaveType };

export class CreateLeavePolicyDto {
  @ApiProperty({ example: 'Annual Casual Leave' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: LeaveType, example: LeaveType.CASUAL })
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @ApiProperty({ description: 'Total leave days entitlement per year', example: 12 })
  @IsNumber()
  @Min(0)
  @Max(365)
  daysPerYear: number;

  @ApiPropertyOptional({ description: 'Maximum days that can be carried forward to next year. 0 = no carry forward.', example: 6 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  carryForwardMax?: number;

  @ApiPropertyOptional({
    description: 'How leave days are accrued over time',
    enum: ['monthly', 'quarterly', 'yearly', 'upfront'],
    example: 'monthly',
  })
  @IsIn(['monthly', 'quarterly', 'yearly', 'upfront'])
  @IsOptional()
  accrualType?: string;

  @ApiPropertyOptional({ description: 'Whether unused leave days can be encashed', example: false })
  @IsBoolean()
  @IsOptional()
  isEncashable?: boolean;

  @ApiPropertyOptional({ description: 'Whether absent during leave is marked as Loss of Pay', example: false })
  @IsBoolean()
  @IsOptional()
  isLopEligible?: boolean;

  @ApiPropertyOptional({ description: 'Minimum advance notice required (in days)', example: 1 })
  @IsInt()
  @Min(0)
  @IsOptional()
  minAdvanceDays?: number;

  @ApiPropertyOptional({ description: 'Maximum consecutive days allowed per application', example: 3 })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxConsecutiveDays?: number;

  @ApiPropertyOptional({ description: 'Whether this leave is available during probation period', example: false })
  @IsBoolean()
  @IsOptional()
  allowedInProbation?: boolean;

  @ApiPropertyOptional({
    description: 'Restrict leave to a specific gender. null = all genders.',
    enum: ['MALE', 'FEMALE'],
    example: null,
  })
  @IsIn(['MALE', 'FEMALE'])
  @IsOptional()
  genderRestriction?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
