import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from '@prisma/client';

export class LeaveRuleSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() ruleType: string;
  @ApiProperty() priority: number;
  @ApiProperty() isActive: boolean;
}

export class LeavePolicyTypeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() leavePolicyId: string;
  @ApiProperty({ enum: LeaveType }) leaveType: LeaveType;
  @ApiPropertyOptional() name: string | null;
  @ApiProperty() daysPerYear: number;
  @ApiProperty() carryForwardMax: number;
  @ApiProperty() accrualType: string;
  @ApiProperty() isEncashable: boolean;
  @ApiProperty() isLopEligible: boolean;
  @ApiProperty() minAdvanceDays: number;
  @ApiPropertyOptional() maxConsecutiveDays: number | null;
  @ApiProperty() allowedInProbation: boolean;
  @ApiPropertyOptional() genderRestriction: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class LeavePolicyResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() name: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() employeeCount: number;
  @ApiProperty({ type: [LeavePolicyTypeResponseDto] }) types: LeavePolicyTypeResponseDto[];
  @ApiPropertyOptional({ type: [LeaveRuleSummaryDto] }) rules?: LeaveRuleSummaryDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() deletedAt: Date | null;
}
