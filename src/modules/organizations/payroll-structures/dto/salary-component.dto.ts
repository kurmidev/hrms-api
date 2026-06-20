import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export enum SalaryComponentBaseOn {
  CTC = 'CTC',
  BASIC = 'BASIC',
  GROSS = 'GROSS',
}

export class SalaryComponentDto {
  @ApiProperty({ example: 'Basic' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ['FIXED', 'VARIABLE', 'PERCENTAGE'], example: 'PERCENTAGE' })
  @IsIn(['FIXED', 'VARIABLE', 'PERCENTAGE'])
  type: 'FIXED' | 'VARIABLE' | 'PERCENTAGE';

  @ApiProperty({
    description: 'FIXED: monthly amount in org currency. PERCENTAGE: 0-100 percent of baseOn. VARIABLE: base rate/cap.',
    example: 40,
  })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({
    enum: SalaryComponentBaseOn,
    default: SalaryComponentBaseOn.CTC,
    description: 'For PERCENTAGE type — what the percentage is calculated against. Defaults to CTC.',
  })
  @IsIn(['CTC', 'BASIC', 'GROSS'])
  @IsOptional()
  baseOn?: SalaryComponentBaseOn;

  @ApiProperty({ description: 'true = deduction (PF, ESI); false = earning (Basic, HRA)', example: false })
  @IsBoolean()
  isDeductible: boolean;

  @ApiPropertyOptional({ description: 'true = statutory component (auto-computed by payroll engine)' })
  @IsBoolean()
  @IsOptional()
  isStatutory?: boolean;

  @ApiPropertyOptional({ example: '40% of CTC' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;
}
