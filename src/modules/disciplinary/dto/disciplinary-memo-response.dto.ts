import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisciplinaryActionType } from '@prisma/client';

export class DisciplinaryMemoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: DisciplinaryActionType })
  type: DisciplinaryActionType;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  issuedBy: string;

  @ApiPropertyOptional({ nullable: true })
  issuingAuthority: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvalReference: string | null;

  @ApiProperty()
  issuedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  acknowledgedAt: Date | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    description:
      'Present only in the create response — whether this memo tripped the 5-memo threshold',
  })
  terminationReviewTriggered?: boolean;
}
