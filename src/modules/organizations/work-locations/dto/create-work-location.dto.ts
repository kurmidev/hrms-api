import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkLocationDto {
  @ApiProperty({ example: 'HQ - Andheri' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 19.076 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 72.8777 })
  @IsNumber()
  lng: number;

  @ApiProperty({ example: 200, description: 'Recognition radius in meters' })
  @IsNumber()
  radiusMeters: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
