import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class SubmitRatingDto {
  @ApiProperty({ description: 'Ratee employee UUID' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 4 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isEligibleForIncrement?: boolean;
}
