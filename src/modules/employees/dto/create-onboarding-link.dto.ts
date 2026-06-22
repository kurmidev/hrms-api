import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNumberString, IsOptional, IsString, Length, Max, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOnboardingLinkDto {
  @ApiProperty({ example: 'raj.patel@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '9876543210', description: '10-digit mobile number' })
  @IsNumberString()
  @Length(10, 10)
  phone: string;

  @ApiPropertyOptional({ example: 'Raj Patel', description: 'Pre-fill candidate name in form' })
  @IsString()
  @IsOptional()
  candidateName?: string;

  @ApiPropertyOptional({ example: 7, description: 'Link validity in days (1–30)', default: 7 })
  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  @Type(() => Number)
  expiresInDays?: number;
}
