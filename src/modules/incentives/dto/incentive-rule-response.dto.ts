import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IncentiveRuleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional({ nullable: true })
  category: unknown | null;

  @ApiProperty()
  rate: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
