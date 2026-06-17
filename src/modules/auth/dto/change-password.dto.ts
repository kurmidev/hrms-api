import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass@123', description: 'Current password' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewPass@456', description: 'New password — minimum 8 characters', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ example: true })
  changed: boolean;

  @ApiProperty({ example: 'Password changed successfully. Please log in again.' })
  message: string;
}
