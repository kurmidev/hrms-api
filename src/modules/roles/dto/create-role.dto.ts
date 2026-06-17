import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    example: 'branch_manager',
    description: 'Unique role name within the organization',
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({
    example: 'Manages a single branch and approves leave for branch employees',
    description: 'Human-readable description of the role',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: ['employee:read', 'leave:approve', 'attendance:read'],
    description: 'Flat list of permission strings in resource:action format',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
