import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AssignServiceRequestDto {
  @ApiProperty({ description: 'User UUID the request is assigned to' })
  @IsUUID()
  assignedTo: string;

  @ApiPropertyOptional({ description: 'Override the computed SLA deadline' })
  @IsOptional()
  @IsDateString()
  slaDeadline?: string;
}
