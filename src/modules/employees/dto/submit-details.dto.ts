import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

class AddressDto {
  @ApiProperty() @IsString() @IsNotEmpty() line1: string;
  @ApiPropertyOptional() @IsString() @IsOptional() line2?: string;
  @ApiProperty() @IsString() @IsNotEmpty() city: string;
  @ApiProperty() @IsString() @IsNotEmpty() state: string;
  @ApiProperty() @IsString() @IsNotEmpty() pincode: string;
}

class EmergencyContactDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiProperty() @IsNumberString() @Length(10, 10) phone: string;
  @ApiProperty() @IsString() @IsNotEmpty() relation: string;
}

export class SubmitDetailsDto {
  @ApiProperty() @IsString() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() lastName: string;
  @ApiProperty({ example: '1995-04-12' }) @IsDateString() dateOfBirth: string;
  @ApiProperty({ enum: Gender }) @IsEnum(Gender) gender: Gender;

  @ApiPropertyOptional({ example: 'raj@example.com' })
  @IsEmail()
  @IsOptional()
  personalEmail?: string;

  @ApiProperty({ type: AddressDto }) @ValidateNested() @Type(() => AddressDto) address: AddressDto;
  @ApiPropertyOptional({ type: EmergencyContactDto })
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContact?: EmergencyContactDto;

  @ApiProperty({ example: 'HDFC Bank' }) @IsString() @IsNotEmpty() bankName: string;
  @ApiProperty({ example: '123456789012' }) @IsString() @IsNotEmpty() accountNumber: string;
  @ApiProperty({ example: 'HDFC0001234' }) @IsString() @IsNotEmpty() ifscCode: string;
  @ApiProperty({ example: 'SAVINGS', enum: ['SAVINGS', 'CURRENT'] })
  @IsString()
  @IsNotEmpty()
  accountType: string;
}
