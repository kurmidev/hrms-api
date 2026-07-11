import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanStatus } from '@prisma/client';

export class LoanEmployeeSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  empCode: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional({ nullable: true })
  departmentName?: string | null;
}

export class LoanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty({ type: LoanEmployeeSummaryDto })
  employee: LoanEmployeeSummaryDto;

  @ApiProperty()
  amountRequested: number;

  @ApiProperty({ nullable: true })
  amountApproved: number | null;

  @ApiProperty({ nullable: true })
  interestRate: number | null;

  @ApiProperty({ nullable: true })
  tenureMonths: number | null;

  @ApiProperty({ enum: LoanStatus })
  status: LoanStatus;

  @ApiProperty({ nullable: true })
  reason: string | null;

  @ApiProperty({ nullable: true })
  approvedBy: string | null;

  @ApiProperty({ nullable: true })
  disbursedAt: Date | null;

  @ApiProperty({ nullable: true })
  closedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
