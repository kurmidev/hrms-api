import { ApiProperty } from '@nestjs/swagger';
import { PayrollRunStatus } from '@prisma/client';

export class PayrollRunResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  organizationId: string;

  @ApiProperty({ example: 7, minimum: 1, maximum: 12 })
  month: number;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ enum: PayrollRunStatus, example: PayrollRunStatus.COMPLETED })
  status: PayrollRunStatus;

  @ApiProperty({ nullable: true, example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  initiatedBy: string | null;

  @ApiProperty({ nullable: true, example: '2026-07-11T10:15:00.000Z' })
  processedAt: Date | null;

  @ApiProperty({ nullable: true, example: '2026-07-12T09:00:00.000Z' })
  approvedAt: Date | null;

  @ApiProperty({ nullable: true, example: '2026-07-13T09:00:00.000Z' })
  disbursedAt: Date | null;

  @ApiProperty({ example: 42, description: 'Number of employee payroll entries in this run' })
  entryCount: number;

  @ApiProperty({ example: 2100000, description: 'Sum of gross salary across all entries' })
  totalGross: number;

  @ApiProperty({
    example: 1890000,
    description: 'Sum of net salary (take-home) across all entries',
  })
  totalNet: number;

  @ApiProperty({ example: 210000, description: 'Sum of all deductions across all entries' })
  totalDeductions: number;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-07-11T10:15:00.000Z' })
  updatedAt: Date;
}
