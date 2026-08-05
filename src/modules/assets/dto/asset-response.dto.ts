import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetStatus } from '@prisma/client';

export class AssetAssignmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  assetId: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  assignedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  returnedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  conditionOnIssue: string | null;

  @ApiPropertyOptional({ nullable: true })
  conditionOnReturn: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty({ description: 'Set by the (future) Exit module when the asset is recovered' })
  recoveredAtExit: boolean;

  @ApiPropertyOptional({ nullable: true })
  recoveryNotes: string | null;
}

export class AssetResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty({ example: 'Laptop' })
  type: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  serialNumber: string | null;

  @ApiProperty({ enum: AssetStatus })
  status: AssetStatus;

  @ApiPropertyOptional({ nullable: true })
  purchaseDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  purchaseValue: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    type: [AssetAssignmentResponseDto],
    description: 'Present on the detail (findOne) response only',
  })
  assignments?: AssetAssignmentResponseDto[];
}

export class AssetAssignmentHistoryResponseDto extends AssetAssignmentResponseDto {
  @ApiProperty({ type: () => AssetResponseDto, description: 'The asset this assignment refers to' })
  asset: AssetResponseDto;
}
