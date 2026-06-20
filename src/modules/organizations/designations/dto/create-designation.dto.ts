import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateDesignationDto {
  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Department this designation belongs to' })
  @IsString()
  departmentId: string;

  @ApiPropertyOptional({
    description: 'Seniority level: 1 = most senior (CEO/Director), higher number = more junior. 0 = unset.',
    example: 3,
  })
  @IsInt()
  @Min(0)
  @Max(20)
  @IsOptional()
  level?: number;

  @ApiPropertyOptional({ description: 'Default payroll structure for this designation' })
  @IsString()
  @IsOptional()
  payrollStructureId?: string;
}
