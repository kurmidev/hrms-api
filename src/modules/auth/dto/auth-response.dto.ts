import { ApiProperty } from '@nestjs/swagger';

export class EmployeeSummaryDto {
  @ApiProperty({ example: 'emp_uuid_123' })
  id: string;

  @ApiProperty({ example: 'G S1084' })
  empCode: string;

  @ApiProperty({ example: 'Saravanan' })
  firstName: string;

  @ApiProperty({ example: 'G S' })
  lastName: string;

  @ApiProperty({ example: 'Finance' })
  department: string;

  @ApiProperty({ example: 'Finance Head' })
  designation: string;
}

export class AuthUserDto {
  @ApiProperty({ example: 'user_uuid_123' })
  id: string;

  @ApiProperty({ example: 'finance@igreentec.in' })
  email: string;

  @ApiProperty({ example: '9876543210', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'org_uuid_456' })
  organizationId: string;

  @ApiProperty({
    example: ['employee:read', 'payroll:view', 'leave:apply'],
    type: [String],
  })
  permissions: string[];

  @ApiProperty({ type: EmployeeSummaryDto, nullable: true })
  employee: EmployeeSummaryDto | null;
}

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX3V1aWQiLCJlbWFpbCI6ImZpbmFuY2VAaWdyZWVudGVjLmluIiwiaWF0IjoxNzEwMDAwMDAwLCJleHAiOjE3MTAwMDA5MDB9.signature',
    description: 'JWT access token — valid for 15 minutes',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh_payload.signature',
    description: 'Refresh token — valid for 30 days; store securely',
  })
  refreshToken: string;

  @ApiProperty({ example: '15m', description: 'Access token validity duration' })
  expiresIn: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

export class OtpSentResponseDto {
  @ApiProperty({ example: true })
  sent: boolean;

  @ApiProperty({ example: 'OTP sent successfully to +91 98765 43210' })
  message: string;

  @ApiProperty({ example: 300, description: 'OTP validity in seconds' })
  validForSeconds: number;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Logged out successfully' })
  message: string;
}

export class DeviceTokenResponseDto {
  @ApiProperty({ example: true })
  registered: boolean;

  @ApiProperty({ example: 'Device token registered for push notifications' })
  message: string;
}
