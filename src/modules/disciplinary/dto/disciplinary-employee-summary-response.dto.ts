import { ApiProperty } from '@nestjs/swagger';

export class DisciplinaryEmployeeSummaryResponseDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  activeMemoCount: number;

  @ApiProperty({ example: 5 })
  threshold: number;

  @ApiProperty()
  flaggedForTerminationReview: boolean;
}
