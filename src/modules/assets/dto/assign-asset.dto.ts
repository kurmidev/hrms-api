import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignAssetDto {
  @ApiProperty({ description: 'Employee UUID to assign the asset to' })
  @IsUUID()
  employeeId: string;

  @ApiPropertyOptional({ example: 'Good condition, no visible damage' })
  @IsOptional()
  @IsString()
  conditionOnIssue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
