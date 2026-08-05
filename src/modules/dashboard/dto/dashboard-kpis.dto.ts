import { ApiProperty } from '@nestjs/swagger';

export class PendingApprovalsBreakdownDto {
  @ApiProperty({ description: 'PENDING LeaveApplication count' })
  leave: number;

  @ApiProperty({ description: 'PENDING LoanApplication count' })
  loan: number;

  @ApiProperty({ description: 'OPEN ServiceRequest count' })
  serviceRequest: number;

  @ApiProperty({ description: 'SUBMITTED TodoTask count (awaiting manager review)' })
  todo: number;
}

export class DashboardKpisDto {
  @ApiProperty({ description: 'Non-deleted employee count' })
  kpi_total_employees: number;

  @ApiProperty({ description: 'Employees with status ACTIVE' })
  kpi_active_employees: number;

  @ApiProperty({ description: 'Employees with status ON_LEAVE' })
  kpi_on_leave: number;

  @ApiProperty({
    nullable: true,
    description:
      'Integer percentage of PRESENT attendance logs vs total logs in the current month-to-date',
  })
  kpi_attendance_rate: number | null;

  @ApiProperty({
    description: 'Sum of pending leave + loan + service-request + todo approvals',
  })
  kpi_pending_approvals: number;

  @ApiProperty({ type: PendingApprovalsBreakdownDto })
  kpi_pending_approvals_breakdown: PendingApprovalsBreakdownDto;

  @ApiProperty({ nullable: true, description: 'Sum of netSalary for the latest PayrollRun' })
  kpi_payroll_total: number | null;

  @ApiProperty({ description: 'Count of LoanApplication with status ACTIVE' })
  kpi_open_loans: number;

  @ApiProperty({ description: 'Count of AssetAssignment not yet returned' })
  kpi_open_assets: number;

  @ApiProperty({ description: 'Count of ServiceRequest with status OPEN' })
  kpi_open_tickets: number;

  @ApiProperty({
    nullable: true,
    description:
      'Sum of current-year LeaveBalance.balanceDays for the caller; null if no employee record',
  })
  kpi_my_leave_balance: number | null;

  @ApiProperty({
    nullable: true,
    description: 'Most recent PerformanceRating.rating for the caller; null if no employee/rating',
  })
  kpi_my_performance: number | null;
}
