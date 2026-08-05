import { ApiProperty } from '@nestjs/swagger';

export class AttendanceByStatusDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  count: number;
}

export class AttendanceEmployeeRowDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  empCode: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  presentDays: number;

  @ApiProperty()
  absentDays: number;

  @ApiProperty()
  lopDays: number;
}

export class AttendanceReportDto {
  @ApiProperty({ description: 'Period start date (ISO)' })
  from: string;

  @ApiProperty({ description: 'Period end date (ISO)' })
  to: string;

  @ApiProperty({ description: 'Total PRESENT/HALF_DAY attendance logs in the period' })
  totalPresent: number;

  @ApiProperty({ description: 'Total ABSENT attendance logs in the period' })
  totalAbsent: number;

  @ApiProperty({
    description: 'Total loss-of-pay days, summed from matching PayrollEntry.lopDays',
  })
  totalLop: number;

  @ApiProperty({ type: [AttendanceByStatusDto] })
  byStatus: AttendanceByStatusDto[];

  @ApiProperty({ type: [AttendanceEmployeeRowDto], description: 'Paginated per-employee rows' })
  rows: AttendanceEmployeeRowDto[];

  @ApiProperty()
  meta: { total: number; page: number; limit: number; totalPages: number };
}
