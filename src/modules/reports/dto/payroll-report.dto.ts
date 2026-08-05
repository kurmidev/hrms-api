import { ApiProperty } from '@nestjs/swagger';

export class PayrollComponentBreakdownDto {
  @ApiProperty()
  basicSalary: number;

  @ApiProperty()
  hra: number;

  @ApiProperty()
  specialAllowance: number;

  @ApiProperty()
  educationAllowance: number;

  @ApiProperty()
  otherAllowances: number;

  @ApiProperty()
  incentiveAmount: number;

  @ApiProperty()
  overtimeAmount: number;

  @ApiProperty()
  travelAllowance: number;

  @ApiProperty()
  bonus: number;

  @ApiProperty()
  greenThanksAmount: number;

  @ApiProperty()
  pfEmployee: number;

  @ApiProperty()
  pfEmployer: number;

  @ApiProperty()
  esiEmployee: number;

  @ApiProperty()
  esiEmployer: number;

  @ApiProperty()
  professionalTax: number;

  @ApiProperty()
  tds: number;

  @ApiProperty()
  loanDeduction: number;

  @ApiProperty()
  advanceDeduction: number;

  @ApiProperty()
  otherDeductions: number;
}

export class PayrollReportDto {
  @ApiProperty({ nullable: true })
  runId: string | null;

  @ApiProperty()
  month: number;

  @ApiProperty()
  year: number;

  @ApiProperty({ nullable: true })
  status: string | null;

  @ApiProperty({ description: 'Number of PayrollEntry rows in the run' })
  employeeCount: number;

  @ApiProperty({ description: 'Sum of PayrollEntry.grossSalary' })
  totalGross: number;

  @ApiProperty({ description: 'Sum of PayrollEntry.netSalary (total disbursed)' })
  totalDisbursed: number;

  @ApiProperty({ type: PayrollComponentBreakdownDto })
  componentBreakdown: PayrollComponentBreakdownDto;
}
