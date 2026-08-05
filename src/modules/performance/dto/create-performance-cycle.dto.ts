import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class CreatePerformanceCycleDto {
  @ApiProperty({ example: 'Q1 2026' })
  @IsString()
  name: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    enum: ['DRAFT', 'ACTIVE'],
    default: 'DRAFT',
    description: 'Cannot create a cycle as CLOSED',
  })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE'])
  status?: 'DRAFT' | 'ACTIVE';
}
