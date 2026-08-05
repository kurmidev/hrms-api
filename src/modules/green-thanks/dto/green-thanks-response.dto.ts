import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GreenThanksEmployeeSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  empCode: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;
}

export class GreenThanksResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fromEmployeeId: string;

  @ApiProperty({ type: GreenThanksEmployeeSummaryDto, nullable: true })
  fromEmployee: GreenThanksEmployeeSummaryDto | null;

  @ApiProperty()
  toEmployeeId: string;

  @ApiProperty({ type: GreenThanksEmployeeSummaryDto, nullable: true })
  toEmployee: GreenThanksEmployeeSummaryDto | null;

  @ApiProperty()
  points: number;

  @ApiProperty()
  reason: string;

  @ApiProperty({ enum: ['pending', 'approved', 'rejected'] })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  awardedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  payrollMonth: number | null;

  @ApiPropertyOptional({ nullable: true })
  payrollYear: number | null;

  @ApiProperty()
  isPaid: boolean;

  @ApiProperty()
  createdAt: Date;
}
