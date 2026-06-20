import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from '@prisma/client';

export class LeaveRuleSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() ruleType: string;
  @ApiProperty() priority: number;
  @ApiProperty() isActive: boolean;
}

export class LeavePolicyResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: LeaveType }) leaveType: LeaveType;
  @ApiProperty() daysPerYear: number;
  @ApiProperty() carryForwardMax: number;
  @ApiProperty() accrualType: string;
  @ApiProperty() isEncashable: boolean;
  @ApiProperty() isLopEligible: boolean;
  @ApiProperty() minAdvanceDays: number;
  @ApiPropertyOptional() maxConsecutiveDays: number | null;
  @ApiProperty() allowedInProbation: boolean;
  @ApiPropertyOptional() genderRestriction: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() employeeCount: number;
  @ApiPropertyOptional({ type: [LeaveRuleSummaryDto] }) rules?: LeaveRuleSummaryDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() deletedAt: Date | null;
}
