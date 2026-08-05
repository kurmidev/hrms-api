import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PerformanceCycleStatus } from '@prisma/client';

export class RatingEmployeeSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  empCode: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;
}

export class RatingCycleSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: PerformanceCycleStatus })
  status: PerformanceCycleStatus;
}

export class PerformanceRatingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  cycleId: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  ratedBy: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional({ nullable: true })
  comments: string | null;

  @ApiProperty()
  isEligibleForIncrement: boolean;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: RatingEmployeeSummaryDto, nullable: true })
  employee: RatingEmployeeSummaryDto | null;

  @ApiPropertyOptional({ type: RatingEmployeeSummaryDto, nullable: true })
  rater: RatingEmployeeSummaryDto | null;

  @ApiPropertyOptional({ type: RatingCycleSummaryDto, nullable: true })
  cycle: RatingCycleSummaryDto | null;
}
