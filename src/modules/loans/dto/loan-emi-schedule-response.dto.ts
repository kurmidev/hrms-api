import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoanEmiScheduleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  loanId: string;

  @ApiPropertyOptional({
    description: '1-based ordinal, derived from (emiYear, emiMonth) ordering',
  })
  installmentNo?: number;

  @ApiProperty()
  emiMonth: number;

  @ApiProperty()
  emiYear: number;

  @ApiProperty()
  emiAmount: number;

  @ApiProperty()
  principal: number;

  @ApiProperty()
  interest: number;

  @ApiProperty()
  outstandingBalance: number;

  @ApiProperty()
  isDeducted: boolean;

  @ApiProperty({ nullable: true })
  payrollEntryId: string | null;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty({ nullable: true })
  paidAt: Date | null;
}
