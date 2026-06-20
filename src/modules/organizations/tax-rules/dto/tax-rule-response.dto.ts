import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaxApplicableOn, TaxCalculationType } from './create-tax-rule.dto';

export class TaxRuleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() code: string | null;
  @ApiProperty() type: string;
  @ApiProperty({ enum: TaxCalculationType }) calculationType: string;
  @ApiProperty({ enum: TaxApplicableOn }) applicableOn: string;
  @ApiProperty() isStatutory: boolean;
  @ApiProperty() config: Record<string, unknown>;
  @ApiPropertyOptional() applicabilityRules: Record<string, unknown> | null;
  @ApiProperty() effectiveFrom: Date;
  @ApiPropertyOptional() effectiveTo: Date | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() deletedAt: Date | null;
}
