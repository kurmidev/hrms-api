import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class SettleExitDto {
  @ApiProperty({ example: 45000, description: 'Final settlement amount payable to the employee' })
  @IsNumber()
  @IsPositive()
  settlementAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
