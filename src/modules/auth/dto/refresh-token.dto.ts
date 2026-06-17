import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token received during login',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class RegisterDeviceTokenDto {
  @ApiProperty({
    example: 'fcm_token_abc123xyz',
    description: 'Firebase Cloud Messaging (FCM) device token for push notifications',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'android',
    description: 'Device platform',
    enum: ['android', 'ios', 'web'],
  })
  @IsString()
  @IsNotEmpty()
  platform: string;
}
