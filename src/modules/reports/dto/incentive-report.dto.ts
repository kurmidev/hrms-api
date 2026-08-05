import { ApiProperty } from '@nestjs/swagger';

export class IncentiveReportRowDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  empCode: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  payrollMonth: number;

  @ApiProperty()
  payrollYear: number;

  @ApiProperty({ description: 'Sum of IncentiveLedger.totalAmount for this employee/month' })
  totalAmount: number;
}

export class IncentiveReportDto {
  @ApiProperty({ nullable: true })
  month: number | null;

  @ApiProperty({ nullable: true })
  year: number | null;

  @ApiProperty({ description: 'Sum of IncentiveLedger.totalAmount across all matched rows' })
  totalAmount: number;

  @ApiProperty({ type: [IncentiveReportRowDto], description: 'Paginated per-employee/month rows' })
  rows: IncentiveReportRowDto[];

  @ApiProperty()
  meta: { total: number; page: number; limit: number; totalPages: number };
}
