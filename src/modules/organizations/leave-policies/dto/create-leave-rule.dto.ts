import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const RULE_TYPES = ['ELIGIBILITY', 'ENTITLEMENT', 'APPLICATION', 'APPROVAL', 'CARRY_FORWARD'] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export const CONDITION_LOGIC_OPTIONS = ['AND', 'OR'] as const;

export const ALLOWED_CONDITION_FIELDS = [
  'employmentType',
  'yearsOfService',
  'designationLevel',
  'gender',
  'daysRequested',
] as const;

export const CONDITION_OPERATORS = ['EQ', 'NEQ', 'GTE', 'LTE', 'GT', 'LT', 'IN', 'NOT_IN'] as const;

export class LeaveRuleConditionDto {
  @ApiProperty({
    enum: ALLOWED_CONDITION_FIELDS,
    description: 'The field to evaluate in the condition',
    example: 'yearsOfService',
  })
  @IsIn(ALLOWED_CONDITION_FIELDS)
  field: string;

  @ApiProperty({
    enum: CONDITION_OPERATORS,
    description: 'Comparison operator. Use IN/NOT_IN for employmentType (value must be array).',
    example: 'GTE',
  })
  @IsIn(CONDITION_OPERATORS)
  operator: string;

  @ApiProperty({
    description: 'Value to compare against. Array for IN/NOT_IN, scalar otherwise.',
    example: 2,
  })
  value: unknown;
}

export class LeaveRuleActionDto {
  @ApiProperty({
    description: `Action type. Must match ruleType:
    ELIGIBILITY → ALLOW | DENY
    ENTITLEMENT → SET_DAYS | ADD_DAYS
    APPLICATION → SET_MIN_ADVANCE | SET_MAX_CONSECUTIVE | SET_MAX_PER_YEAR
    APPROVAL    → AUTO_APPROVE | MANAGER | HR | MULTI_LEVEL
    CARRY_FORWARD → SET_MAX_DAYS | SET_EXPIRY_MONTHS | ENCASH_REMAINDER`,
    example: 'SET_DAYS',
  })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: 'Numeric value (days, months, levels). Required for most non-DENY/AUTO_APPROVE actions.', example: 12 })
  value?: number;

  @ApiPropertyOptional({ description: 'Human-readable reason (used for DENY actions)', example: 'Not eligible during probation' })
  reason?: string;

  @ApiPropertyOptional({ description: 'Number of approval levels for MULTI_LEVEL approvals', example: 2 })
  levels?: number;
}

export class CreateLeaveRuleDto {
  @ApiProperty({ example: 'Extra day for 5+ years of service' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: RULE_TYPES, description: 'What aspect of the leave policy this rule governs' })
  @IsIn(RULE_TYPES)
  ruleType: RuleType;

  @ApiProperty({
    enum: CONDITION_LOGIC_OPTIONS,
    default: 'AND',
    description: 'Whether ALL conditions must be true (AND) or just one (OR)',
  })
  @IsIn(CONDITION_LOGIC_OPTIONS)
  conditionLogic: 'AND' | 'OR';

  @ApiProperty({ type: [LeaveRuleConditionDto], description: 'Conditions that must be satisfied for this rule to fire' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeaveRuleConditionDto)
  conditions: LeaveRuleConditionDto[];

  @ApiProperty({ type: LeaveRuleActionDto, description: 'Action to execute when conditions are satisfied' })
  @IsObject()
  @ValidateNested()
  @Type(() => LeaveRuleActionDto)
  action: LeaveRuleActionDto;

  @ApiPropertyOptional({ description: 'Execution order — lower number runs first', example: 10 })
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
