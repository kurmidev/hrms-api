import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { RefreshTokenDto, RegisterDeviceTokenDto } from './dto/refresh-token.dto';
import {
  AuthResponseDto,
  OtpSentResponseDto,
  LogoutResponseDto,
  AuthUserDto,
  DeviceTokenResponseDto,
} from './dto/auth-response.dto';
import { ChangePasswordDto, ChangePasswordResponseDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiCommonErrorResponses } from '../../common/swagger/api-responses.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /auth/login ──────────────────────────────────────────────────────

  @Public()
  @UseGuards(ThrottlerGuard, AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Authenticates a user with email and password. Returns a JWT access token (15 min) and a refresh token (30 days). Rate limited to 5 requests per minute.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful — returns access token, refresh token and user profile',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/login',
        method: 'POST',
        error: 'Invalid email or password',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed — email format invalid or password too short',
    schema: {
      example: {
        statusCode: 400,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/login',
        method: 'POST',
        error: 'Please provide a valid email address',
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many login attempts — rate limit exceeded',
    schema: {
      example: {
        statusCode: 429,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/login',
        method: 'POST',
        error: 'ThrottlerException: Too Many Requests',
      },
    },
  })
  async login(@Req() req: Request & { user: any }, @Body() _dto: LoginDto) {
    const organizationId = req.user.employee?.organizationId ?? '';
    return this.authService.login(
      req.user.id,
      organizationId,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // ── POST /auth/otp/send ───────────────────────────────────────────────────

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send OTP to mobile number',
    description:
      'Sends a 6-digit OTP via SMS to the registered mobile number. OTP is valid for 5 minutes. Rate limited to 3 requests per minute.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    type: OtpSentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No active account found for this phone number',
    schema: {
      example: {
        statusCode: 404,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/otp/send',
        method: 'POST',
        error: 'No active account found for this phone number',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid phone number format',
    schema: {
      example: {
        statusCode: 400,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/otp/send',
        method: 'POST',
        error: 'Please provide a valid 10-digit Indian mobile number',
      },
    },
  })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  // ── POST /auth/otp/verify ─────────────────────────────────────────────────

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and get tokens',
    description:
      'Verifies the OTP sent to the mobile number. On success, returns the same token pair as password login. OTP is invalidated after one successful use.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified — returns access token, refresh token and user profile',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired OTP',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/otp/verify',
        method: 'POST',
        error: 'Invalid or expired OTP',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'OTP must be exactly 6 digits',
    schema: {
      example: {
        statusCode: 400,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/otp/verify',
        method: 'POST',
        error: 'OTP must be exactly 6 digits',
      },
    },
  })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyOtp(dto.phone, dto.otp, req.ip, req.headers['user-agent']);
  }

  // ── POST /auth/refresh ────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchanges a valid refresh token for a new access token + refresh token pair. The old refresh token is invalidated (token rotation). Store the new refresh token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_access_token.signature',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_refresh_token.signature',
          expiresIn: '15m',
        },
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token is invalid, expired, or has been revoked',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/refresh',
        method: 'POST',
        error: 'Refresh token has been revoked',
      },
    },
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // ── POST /auth/logout ─────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout current session',
    description:
      'Invalidates the refresh token and closes the active session. The access token will expire naturally after 15 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    type: LogoutResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — missing or invalid access token',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/logout',
        method: 'POST',
        error: 'Invalid or expired token',
      },
    },
  })
  logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  // ── GET /auth/me ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the full profile of the authenticated user including their employee details, assigned roles, and flattened permission list.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: AuthUserDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/me',
        method: 'GET',
        error: 'Invalid or expired token',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User account no longer exists',
    schema: {
      example: {
        statusCode: 404,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/me',
        method: 'GET',
        error: 'User not found',
      },
    },
  })
  getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  // ── POST /auth/device-token ───────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('device-token')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register device for push notifications',
    description:
      'Registers a Firebase Cloud Messaging (FCM) token for the current device. Used to send push notifications for approvals, notices, reminders, and chat messages.',
  })
  @ApiResponse({
    status: 200,
    description: 'Device token registered successfully',
    type: DeviceTokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/device-token',
        method: 'POST',
        error: 'Invalid or expired token',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Token or platform field is missing',
    schema: {
      example: {
        statusCode: 400,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/device-token',
        method: 'POST',
        error: 'token should not be empty',
      },
    },
  })
  @ApiCommonErrorResponses()
  registerDeviceToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.authService.registerDeviceToken(userId, dto.token, dto.platform);
  }

  // ── PUT /auth/change-password ─────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password',
    description:
      'Changes the authenticated user\'s password. On success, all active refresh tokens are revoked and the user must log in again.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: ChangePasswordResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Current password is incorrect or token is invalid',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/change-password',
        method: 'PUT',
        error: 'Current password is incorrect',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'New password does not meet requirements (min 8 characters)',
    schema: {
      example: {
        statusCode: 400,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/change-password',
        method: 'PUT',
        error: 'newPassword must be longer than or equal to 8 characters',
      },
    },
  })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }

  // ── GET /auth/sessions ────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List active sessions',
    description: 'Returns all open sessions for the authenticated user — each entry shows IP address, device/browser, and login time.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active sessions list',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'a1b2c3d4-...',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            loginAt: '2024-01-15T10:30:00.000Z',
          },
        ],
        timestamp: '2024-01-15T11:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/sessions',
        method: 'GET',
        error: 'Invalid or expired token',
      },
    },
  })
  getSessions(@CurrentUser('id') userId: string) {
    return this.authService.getSessions(userId);
  }

  // ── DELETE /auth/sessions ─────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout from all devices',
    description: 'Revokes all active sessions and refresh tokens for the authenticated user. Every device will require a fresh login.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out from all devices',
    schema: {
      example: {
        success: true,
        data: { success: true, message: 'Logged out from all devices' },
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/sessions',
        method: 'DELETE',
        error: 'Invalid or expired token',
      },
    },
  })
  logoutAll(@CurrentUser('id') userId: string) {
    return this.authService.logoutAll(userId);
  }

  // ── DELETE /auth/sessions/:sessionId ──────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Terminate a specific session',
    description: 'Closes a single active session by its ID. Useful for revoking access from a specific device without affecting others.',
  })
  @ApiResponse({
    status: 200,
    description: 'Session terminated',
    schema: {
      example: {
        success: true,
        data: { success: true, message: 'Session terminated' },
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found or does not belong to this user',
    schema: {
      example: {
        statusCode: 404,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/sessions/a1b2c3d4',
        method: 'DELETE',
        error: 'Session not found',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/sessions/a1b2c3d4',
        method: 'DELETE',
        error: 'Invalid or expired token',
      },
    },
  })
  logoutSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.authService.logoutSession(userId, sessionId);
  }
}
