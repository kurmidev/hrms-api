import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ example: 'user-uuid-here', description: 'ID of the user to assign the role to' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'role-uuid-here', description: 'ID of the role to assign' })
  @IsUUID()
  roleId: string;
}
