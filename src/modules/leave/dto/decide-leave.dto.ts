import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ApproveLeaveDto {
  @ApiPropertyOptional({ example: 'Approved, enjoy your leave' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectLeaveDto {
  @ApiProperty({ example: 'Insufficient staffing on requested dates' })
  @IsString()
  @MinLength(3)
  rejectionNote: string;
}
