import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
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

class PreviousEmploymentDto {
  @ApiPropertyOptional({ example: 'ABC Corp' }) @IsString() @IsOptional() lastEmployerName?: string;
  @ApiPropertyOptional({ example: 'Senior Engineer' }) @IsString() @IsOptional() jobTitleAtLastEmployer?: string;
  @ApiPropertyOptional({ example: '2022-01-01' }) @IsDateString() @IsOptional() employmentFrom?: string;
  @ApiPropertyOptional({ example: '2025-12-31' }) @IsDateString() @IsOptional() employmentTo?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() lastManagerName?: string;
  @ApiPropertyOptional({ example: '9876543210' }) @IsString() @IsOptional() lastManagerContact?: string;
  @ApiPropertyOptional({ example: 'hr@abc.com' }) @IsString() @IsOptional() hrContactAtPreviousEmployer?: string;
  @ApiPropertyOptional({ example: 'Better opportunity' }) @IsString() @IsOptional() reasonForLeaving?: string;
}

class ReferenceContactDto {
  @ApiProperty({ example: 'Amit Sharma' }) @IsString() @IsNotEmpty() name: string;
  @ApiProperty({ example: '9876543210' }) @IsString() @IsNotEmpty() contact: string;
}

export class SubmitDetailsDto {
  @ApiProperty() @IsString() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() lastName: string;
  @ApiProperty({ example: '1995-04-12' }) @IsDateString() dateOfBirth: string;
  @ApiProperty({ enum: Gender }) @IsEnum(Gender) gender: Gender;

  @ApiPropertyOptional({ example: 'Indian', description: 'Nationality of the candidate' })
  @IsString()
  @IsOptional()
  nationality?: string;

  @ApiPropertyOptional({ example: '9876543210', description: 'Personal mobile number of the candidate' })
  @IsNumberString()
  @Length(10, 10)
  @IsOptional()
  phone?: string;

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

  @ApiPropertyOptional({ example: 'B+', description: 'Blood group (e.g. A+, O-, AB+)' })
  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @ApiPropertyOptional({ example: 'Type 2 Diabetes', description: 'Details of any existing health conditions' })
  @IsString()
  @IsOptional()
  existingHealthIssues?: string;

  @ApiPropertyOptional({ type: PreviousEmploymentDto, description: 'Previous employment details' })
  @ValidateNested()
  @Type(() => PreviousEmploymentDto)
  @IsOptional()
  previousEmployment?: PreviousEmploymentDto;

  @ApiPropertyOptional({ type: [ReferenceContactDto], description: 'Up to 2 professional references' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceContactDto)
  @ArrayMaxSize(2)
  @IsOptional()
  referenceContacts?: ReferenceContactDto[];

  @ApiProperty({ example: 'HDFC Bank' }) @IsString() @IsNotEmpty() bankName: string;
  @ApiProperty({ example: '123456789012' }) @IsString() @IsNotEmpty() accountNumber: string;
  @ApiProperty({ example: 'HDFC0001234' }) @IsString() @IsNotEmpty() ifscCode: string;
  @ApiProperty({ example: 'SAVINGS', enum: ['SAVINGS', 'CURRENT'] })
  @IsString()
  @IsNotEmpty()
  accountType: string;

  @ApiProperty({ description: 'Candidate must declare that all provided information is true and accurate' })
  @IsBoolean()
  @Equals(true, { message: 'You must accept the declaration to submit' })
  declarationAccepted: boolean;
}
