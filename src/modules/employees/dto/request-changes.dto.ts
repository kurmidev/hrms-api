import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RequestChangesDto {
  @ApiProperty({ example: 'Please re-upload a clearer copy of your Aadhaar card.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  notes: string;
}
