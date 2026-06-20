import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { CurrencyCode } from '../../../common/enums/currency.enum';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ enum: CurrencyCode, example: CurrencyCode.INR })
  @IsEnum(CurrencyCode)
  @IsOptional()
  currency?: CurrencyCode;
  @ApiPropertyOptional({ example: 'IGreen Technologies' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsUrl()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '123 Business Park, Mumbai, MH 400001' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'admin@company.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'https://company.com' })
  @IsUrl()
  @IsOptional()
  website?: string;
}
