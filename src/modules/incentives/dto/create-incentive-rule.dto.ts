import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateIncentiveRuleDto {
  @ApiProperty({ example: 'Delivery Bonus' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'per_unit' })
  @IsString()
  type: string;

  @ApiPropertyOptional({
    description: 'Free-form JSON category metadata',
    example: { tier: 'field' },
  })
  @IsOptional()
  category?: unknown;

  @ApiProperty({ example: 50, minimum: 0, description: 'Amount per unit/quantity' })
  @IsNumber()
  @Min(0)
  rate: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
