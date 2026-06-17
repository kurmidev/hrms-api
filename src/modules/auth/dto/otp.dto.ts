import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    example: '9876543210',
    description: '10-digit Indian mobile number (without country code)',
    pattern: '^[6-9]\\d{9}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Please provide a valid 10-digit Indian mobile number' })
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    example: '9876543210',
    description: '10-digit mobile number the OTP was sent to',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Please provide a valid 10-digit mobile number' })
  phone: string;

  @ApiProperty({
    example: '483920',
    description: '6-digit OTP received via SMS',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}
