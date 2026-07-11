import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export class ManualEntryDto {
  @ApiProperty({ description: 'Employee UUID' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: '2026-07-08' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'ISO check-in timestamp' })
  @IsOptional()
  @IsISO8601()
  checkInAt?: string;

  @ApiPropertyOptional({ description: 'ISO check-out timestamp' })
  @IsOptional()
  @IsISO8601()
  checkOutAt?: string;

  @ApiPropertyOptional({ enum: AttendanceStatus, default: AttendanceStatus.PRESENT })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
