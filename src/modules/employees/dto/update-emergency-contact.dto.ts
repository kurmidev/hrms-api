import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, IsOptional, IsString, Length } from 'class-validator';

export class UpdateEmergencyContactDto {
  @ApiProperty({ example: 'Priya Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '9876543210' })
  @IsNumberString()
  @Length(10, 10, { message: 'Phone must be exactly 10 digits' })
  phone: string;

  @ApiProperty({ example: 'Spouse' })
  @IsString()
  @IsNotEmpty()
  relation: string;

  @ApiPropertyOptional({ example: '9123456789' })
  @IsOptional()
  @IsNumberString()
  @Length(10, 10)
  alternatePhone?: string;

  @ApiPropertyOptional({ example: '123 Main St, Mumbai' })
  @IsOptional()
  @IsString()
  address?: string;
}
