import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InsuranceType } from '@prisma/client';

export class InsurancePolicyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  provider: string;

  @ApiProperty()
  policyNumber: string;

  @ApiProperty({ enum: InsuranceType })
  type: InsuranceType;

  @ApiPropertyOptional({ nullable: true })
  coverageAmount: number | null;

  @ApiPropertyOptional({ nullable: true })
  premium: number | null;

  @ApiPropertyOptional({ nullable: true })
  validFrom: Date | null;

  @ApiPropertyOptional({ nullable: true })
  validTo: Date | null;

  @ApiPropertyOptional({ nullable: true })
  renewalDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  documentUrl: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
