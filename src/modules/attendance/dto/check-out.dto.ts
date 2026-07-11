import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional } from 'class-validator';

export class CheckOutDto {
  @ApiPropertyOptional({ example: 19.076 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 72.8777 })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'ISO timestamp override; defaults to server time' })
  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}
