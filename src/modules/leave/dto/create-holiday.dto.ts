import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateHolidayDto {
  @ApiProperty({ example: 'Independence Day' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 'national', default: 'national' })
  @IsOptional()
  @IsString()
  type?: string;
}
