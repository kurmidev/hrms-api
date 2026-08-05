import { ApiProperty } from '@nestjs/swagger';

export class LoanReportRowDto {
  @ApiProperty()
  loanId: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  empCode: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  amountRequested: number;

  @ApiProperty({ nullable: true })
  amountApproved: number | null;

  @ApiProperty()
  status: string;

  @ApiProperty({
    description:
      'Remaining principal+interest as of the next un-deducted EMI row; 0 if fully paid or no schedule',
  })
  outstandingBalance: number;
}

export class LoanReportDto {
  @ApiProperty({ description: 'Count of loans with status ACTIVE' })
  activeLoanCount: number;

  @ApiProperty({ description: 'Sum of outstandingBalance across all ACTIVE loans' })
  totalOutstanding: number;

  @ApiProperty({ type: [LoanReportRowDto], description: 'Paginated per-loan rows' })
  rows: LoanReportRowDto[];

  @ApiProperty()
  meta: { total: number; page: number; limit: number; totalPages: number };
}
