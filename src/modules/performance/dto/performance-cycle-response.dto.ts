import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PerformanceCycleStatus } from '@prisma/client';

export class PerformanceCycleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ enum: PerformanceCycleStatus })
  status: PerformanceCycleStatus;

  @ApiPropertyOptional({ nullable: true })
  closedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
