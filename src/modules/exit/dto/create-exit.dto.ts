import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExitInitiator, ExitType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateExitDto {
  @ApiProperty({ description: 'Employee UUID initiating/undergoing exit' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ enum: ExitType })
  @IsEnum(ExitType)
  type: ExitType;

  @ApiProperty({ enum: ExitInitiator })
  @IsEnum(ExitInitiator)
  initiatedBy: ExitInitiator;

  @ApiProperty({
    description: 'Reason for exit (resignation letter summary, termination cause, etc.)',
  })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Start of the notice period' })
  @IsOptional()
  @IsDateString()
  noticeStartDate?: string;

  @ApiPropertyOptional({ description: 'Last working date' })
  @IsOptional()
  @IsDateString()
  lastWorkingDate?: string;

  @ApiPropertyOptional({ description: 'Effective date of exit' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({
    description: 'Target settlement date; defaults to initiatedAt + 45 calendar days if omitted',
  })
  @IsOptional()
  @IsDateString()
  targetSettlementDate?: string;
}
