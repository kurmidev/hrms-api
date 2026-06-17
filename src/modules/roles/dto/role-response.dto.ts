import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'org-uuid-here' })
  organizationId: string;

  @ApiProperty({ example: 'hr_manager' })
  name: string;

  @ApiPropertyOptional({ example: 'Manages all HR operations' })
  description: string | null;

  @ApiProperty({
    example: ['employee:read', 'leave:approve', 'attendance:read'],
    type: [String],
  })
  permissions: string[];

  @ApiProperty({ example: false, description: 'System roles cannot be deleted or modified' })
  isSystemRole: boolean;

  @ApiProperty({ example: 12, description: 'Number of users currently assigned this role' })
  userCount: number;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-20T08:00:00.000Z' })
  updatedAt: Date;
}
