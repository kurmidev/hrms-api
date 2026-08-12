import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Min } from 'class-validator';

export class AddOdLocationDto {
  @ApiProperty({ example: 19.076 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 72.8777 })
  @IsNumber()
  lng: number;

  @ApiProperty({ example: 45, description: 'Minutes spent on-duty at this location' })
  @IsInt()
  @Min(1)
  minutes: number;
}
