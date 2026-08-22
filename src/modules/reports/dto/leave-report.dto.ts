import { ApiProperty } from '@nestjs/swagger';

export class LeaveEmployeeRowDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  empCode: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  leavePolicyTypeId: string;

  @ApiProperty()
  leaveType: string;

  @ApiProperty()
  entitledDays: number;

  @ApiProperty()
  takenDays: number;

  @ApiProperty()
  balanceDays: number;
}

export class LeaveReportDto {
  @ApiProperty()
  year: number;

  @ApiProperty({ description: 'Count of PENDING leave applications for the organization' })
  pendingApplications: number;

  @ApiProperty({
    type: [LeaveEmployeeRowDto],
    description: 'Paginated per-employee leave balances',
  })
  rows: LeaveEmployeeRowDto[];

  @ApiProperty()
  meta: { total: number; page: number; limit: number; totalPages: number };
}
