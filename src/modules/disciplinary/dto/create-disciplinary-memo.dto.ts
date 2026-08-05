import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisciplinaryActionType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDisciplinaryMemoDto {
  @ApiProperty({ description: 'Employee UUID the memo is issued against' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ enum: DisciplinaryActionType })
  @IsEnum(DisciplinaryActionType)
  type: DisciplinaryActionType;

  @ApiProperty({ example: 'Repeated tardiness', maxLength: 191 })
  @IsString()
  @MaxLength(191)
  title: string;

  @ApiProperty({ description: 'Detailed reason / narrative for the memo' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Name/title of the issuing authority (if distinct)' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  issuingAuthority?: string;

  @ApiPropertyOptional({ description: 'Approval reference (e.g. HR ticket / approval id)' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  approvalReference?: string;

  @ApiPropertyOptional({ description: 'Date the memo was issued; defaults to now' })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;
}
