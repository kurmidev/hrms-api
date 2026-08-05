import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExitInitiator, ExitStatus, ExitType } from '@prisma/client';

export class ExitDepartmentClearanceResponseDto {
  @ApiProperty()
  department: string;

  @ApiProperty()
  cleared: boolean;

  @ApiPropertyOptional({ nullable: true })
  clearedBy?: string | null;

  @ApiPropertyOptional({ nullable: true })
  clearedAt?: string | null;
}

export class ExitAssetHandoverResponseDto {
  @ApiProperty()
  cleared: boolean;

  @ApiProperty()
  unreturnedCount: number;
}

export class ExitKnowledgeTransferResponseDto {
  @ApiProperty()
  cleared: boolean;
}

export class ExitClearanceStatusResponseDto {
  @ApiProperty({ type: [ExitDepartmentClearanceResponseDto] })
  departments: ExitDepartmentClearanceResponseDto[];

  @ApiProperty({ type: ExitAssetHandoverResponseDto })
  assetHandover: ExitAssetHandoverResponseDto;

  @ApiProperty({ type: ExitKnowledgeTransferResponseDto })
  knowledgeTransfer: ExitKnowledgeTransferResponseDto;
}

export class ExitRecordResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty({ enum: ExitType })
  type: ExitType;

  @ApiProperty({ enum: ExitStatus })
  status: ExitStatus;

  @ApiProperty({ enum: ExitInitiator })
  initiatedBy: ExitInitiator;

  @ApiPropertyOptional({ nullable: true })
  reason: string | null;

  @ApiProperty()
  initiatedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  noticeStartDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastWorkingDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  effectiveDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  targetSettlementDate: Date | null;

  @ApiProperty()
  knowledgeTransferComplete: boolean;

  @ApiPropertyOptional({ type: ExitClearanceStatusResponseDto, nullable: true })
  clearanceStatus: ExitClearanceStatusResponseDto | null;

  @ApiPropertyOptional({ nullable: true })
  nocIssuedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  settlementAmount: number | null;

  @ApiPropertyOptional({ nullable: true })
  settledAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt: Date | null;

  @ApiProperty()
  updatedAt: Date;
}

export class ExitSettlementSummaryResponseDto {
  @ApiProperty({ type: ExitRecordResponseDto })
  exitRecord: ExitRecordResponseDto;

  @ApiProperty({ description: 'Referenced (not recomputed) outstanding loan balance' })
  outstandingLoanBalance: number;

  @ApiProperty()
  unreturnedAssetCount: number;

  @ApiProperty()
  settlementAmount: number;
}
