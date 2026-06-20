import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeaveRuleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() leavePolicyId: string;
  @ApiProperty() name: string;
  @ApiProperty() ruleType: string;
  @ApiProperty() conditionLogic: string;
  @ApiProperty() conditions: unknown;
  @ApiProperty() action: unknown;
  @ApiProperty() priority: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() deletedAt: Date | null;
}
