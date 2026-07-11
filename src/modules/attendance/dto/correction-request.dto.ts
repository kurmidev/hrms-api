import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CorrectionRequestDto {
  @ApiProperty({ example: '2026-07-08' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Forgot to check in, was on client site' })
  @IsString()
  @MinLength(3)
  reason: string;

  @ApiPropertyOptional({ description: 'Requested ISO check-in timestamp' })
  @IsOptional()
  @IsISO8601()
  requestedCheckIn?: string;

  @ApiPropertyOptional({ description: 'Requested ISO check-out timestamp' })
  @IsOptional()
  @IsISO8601()
  requestedCheckOut?: string;
}
