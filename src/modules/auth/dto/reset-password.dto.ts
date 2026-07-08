import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token from the email link', example: 'a3f2b1c4...' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPass@456', description: 'New password — minimum 8 characters', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
