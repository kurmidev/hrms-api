import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, Max, Min } from 'class-validator';

export class ApproveLoanDto {
  @ApiProperty({
    example: 12,
    minimum: 0,
    description: 'Annual interest rate (%), e.g. 12 for 12% p.a.',
  })
  @IsNumber()
  @Min(0)
  interestRate: number;

  @ApiPropertyOptional({
    example: 50000,
    description: 'Approved amount; defaults to the requested amount if omitted',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amountApproved?: number;

  @ApiPropertyOptional({
    example: 12,
    minimum: 1,
    maximum: 120,
    description: 'Override tenure; defaults to the tenure requested on the application',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  tenureMonths?: number;
}
