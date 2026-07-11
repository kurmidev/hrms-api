import { ApiProperty } from '@nestjs/swagger';

class PayrollEntryEmployeeSummaryDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id: string;

  @ApiProperty({ example: 'EMP0042' })
  empCode: string;

  @ApiProperty({ example: 'Asha' })
  firstName: string;

  @ApiProperty({ example: 'Rao' })
  lastName: string;

  @ApiProperty({ required: false, nullable: true, example: 'Engineering' })
  departmentName?: string | null;
}

export class PayrollEntryResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  payrollRunId: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  employeeId: string;

  @ApiProperty({ type: PayrollEntryEmployeeSummaryDto })
  employee: PayrollEntryEmployeeSummaryDto;

  @ApiProperty({ example: 26, description: 'Total working days in the payroll period' })
  workingDays: number;

  @ApiProperty({ example: 25, description: 'Days the employee was marked present' })
  presentDays: number;

  @ApiProperty({ example: 1, description: 'Loss-of-pay days deducted from salary' })
  lopDays: number;

  @ApiProperty({ example: 40000 })
  basicSalary: number;

  @ApiProperty({ example: 16000 })
  hra: number;

  @ApiProperty({ example: 8000 })
  specialAllowance: number;

  @ApiProperty({ example: 2000 })
  educationAllowance: number;

  @ApiProperty({ example: 1000 })
  otherAllowances: number;

  @ApiProperty({ example: 0, description: '0 for now (M11)' })
  incentiveAmount: number;

  @ApiProperty({ example: 0, description: '0 for now (M11)' })
  cumulativeIncentive: number;

  @ApiProperty({ example: 0 })
  overtimeAmount: number;

  @ApiProperty({ example: 1500 })
  travelAllowance: number;

  @ApiProperty({ example: 0, description: '0 for now' })
  bonus: number;

  @ApiProperty({ example: 0, description: '0 for now (M12)' })
  greenThanksAmount: number;

  @ApiProperty({ example: 68500 })
  grossSalary: number;

  @ApiProperty({ example: 4800 })
  pfEmployee: number;

  @ApiProperty({ example: 0 })
  esiEmployee: number;

  @ApiProperty({ example: 200 })
  professionalTax: number;

  @ApiProperty({ example: 1200 })
  tds: number;

  @ApiProperty({ example: 0, description: '0 for now (M10)' })
  loanDeduction: number;

  @ApiProperty({ example: 0, description: '0 for now (M10)' })
  advanceDeduction: number;

  @ApiProperty({ example: 500 })
  otherDeductions: number;

  @ApiProperty({ example: 61800 })
  netSalary: number;

  @ApiProperty({ nullable: true, example: '5000 to be paid in cash' })
  remarks: string | null;

  @ApiProperty({ example: 'COMPUTED' })
  status: string;
}
