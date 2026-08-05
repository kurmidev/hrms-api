import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

export class DepartmentClearanceDto {
  @ApiProperty({ example: 'IT' })
  @IsString()
  department: string;

  @ApiProperty()
  @IsBoolean()
  cleared: boolean;

  @ApiPropertyOptional({ description: 'Name/id of the person who cleared this department' })
  @IsOptional()
  @IsString()
  clearedBy?: string;
}

export class UpdateClearanceDto {
  @ApiPropertyOptional({ type: [DepartmentClearanceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentClearanceDto)
  departments?: DepartmentClearanceDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  knowledgeTransferComplete?: boolean;

  @ApiPropertyOptional({
    description: 'If true and every clearance condition is now met, advance status to CLEARED',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  advanceToClearedIfComplete?: boolean;
}
