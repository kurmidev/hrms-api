import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { EmploymentType } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty() @IsString() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() lastName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsNumberString() @Length(10, 10) phone: string;

  @ApiProperty() @IsUUID() departmentId: string;
  @ApiProperty() @IsUUID() designationId: string;
  @ApiProperty() @IsUUID() payrollStructureId: string;
  @ApiProperty() @IsUUID() leavePolicyId: string;

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @ApiProperty({ example: '2026-07-01' }) @IsDateString() joiningDate: string;

  @ApiPropertyOptional() @IsUUID() @IsOptional() reportingManagerId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() empCode?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() probationEndDate?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dateOfBirth?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() gender?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() pfNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() esiNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() uanNumber?: string;
}
