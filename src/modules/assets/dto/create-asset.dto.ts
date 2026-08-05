import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({ example: 'Laptop', description: 'e.g. Laptop / ID Card / SIM / Vehicle / Other' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'Dell Latitude 5420' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'SN-2026-0042' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ example: 65000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseValue?: number;
}
