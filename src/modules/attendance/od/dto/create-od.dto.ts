import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateOdDto {
  @ApiProperty({ example: 19.076 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 72.8777 })
  @IsNumber()
  lng: number;

  @ApiProperty({ example: 90, description: 'Minutes spent on-duty at this location' })
  @IsInt()
  @Min(1)
  minutes: number;

  @ApiPropertyOptional({ example: 'Client site visit for onboarding demo' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
