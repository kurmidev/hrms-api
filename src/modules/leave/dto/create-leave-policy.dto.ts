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

export class CreateLeavePolicyDto {
  @ApiProperty({ example: 'Annual Casual Leave' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: LeaveType, example: LeaveType.CASUAL })
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @ApiProperty({ example: 12 })
  @IsNumber()
  @Min(0)
  @Max(365)
  daysPerYear: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  carryForwardMax?: number;

  @ApiPropertyOptional({ enum: ['monthly', 'quarterly', 'yearly', 'upfront'], example: 'monthly' })
  @IsOptional()
  @IsIn(['monthly', 'quarterly', 'yearly', 'upfront'])
  accrualType?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isEncashable?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isLopEligible?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAdvanceDays?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConsecutiveDays?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allowedInProbation?: boolean;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE'], example: null })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE'])
  genderRestriction?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
