import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectLoanDto {
  @ApiPropertyOptional({ example: 'Insufficient tenure with the organization' })
  @IsOptional()
  @IsString()
  reason?: string;
}
