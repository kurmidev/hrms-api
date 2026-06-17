import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { totp } from 'otplib';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    totp.options = { step: 300, digits: 6 };
  }

  // ── Validate password (used by LocalStrategy) ────────────────────────────

  async validatePassword(email: string, password: string) {
    const lockKey = `lockout:${email}`;
    const failKey = `failed:${email}`;

    const locked = await this.redis.exists(lockKey);
    if (locked) {
      throw new HttpException(
        'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
    });

    if (!user) {
      await this.redis.incr(failKey, 15 * 60);
      return null;
    }

    const match = await bcrypt.compare(password, user.passwordHash);

    if (!match) {
      const attempts = await this.redis.incr(failKey, 15 * 60);
      if (attempts >= 5) {
        await this.redis.set(lockKey, '1', 15 * 60);
      }
      return null;
    }

    await Promise.all([this.redis.del(failKey), this.redis.del(lockKey)]);
    return user;
  }

  // ── Password login ────────────────────────────────────────────────────────

  async login(userId: string, organizationId: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        employee: {
          include: { department: true, designation: true },
        },
      },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const tokens = await this.generateTokens(user.id, user.email, organizationId);

    // Save refresh token & login history in parallel
    await Promise.all([
      this.redis.saveRefreshToken(user.id, tokens.refreshToken, 30 * 24 * 60 * 60),
      this.prisma.loginHistory.create({
        data: {
          userId: user.id,
          ipAddress,
          userAgent,
          status: 'success',
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    const permissions = user.userRoles.flatMap(
      (ur) => (ur.role.permissions as string[]) || [],
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        organizationId,
        permissions: [...new Set(permissions)],
        employee: user.employee
          ? {
              id: user.employee.id,
              empCode: user.employee.empCode,
              firstName: user.employee.firstName,
              lastName: user.employee.lastName,
              department: user.employee.department?.name ?? null,
              designation: user.employee.designation?.name ?? null,
            }
          : null,
      },
    };
  }

  // ── OTP: send ─────────────────────────────────────────────────────────────

  async sendOtp(phone: string): Promise<{ sent: boolean; message: string; validForSeconds: number }> {
    const user = await this.prisma.user.findFirst({
      where: { phone, isActive: true },
    });
    if (!user) throw new NotFoundException('No active account found for this phone number');

    const secret = `${phone}${this.config.get('jwt.secret')}`;
    const otp = totp.generate(secret);

    await this.redis.saveOtp(phone, otp, 300);

    // In production, call Fast2SMS here. Logged to console in dev.
    if (this.config.get('nodeEnv') !== 'production') {
      console.log(`[DEV OTP] Phone: ${phone} → OTP: ${otp}`);
    } else {
      await this.dispatchSms(phone, `Your IGreen HRMS login OTP is: ${otp}. Valid for 5 minutes.`);
    }

    return {
      sent: true,
      message: `OTP sent successfully to +91 ${phone.slice(0, 2)}XXXXXX${phone.slice(-2)}`,
      validForSeconds: 300,
    };
  }

  // ── OTP: verify ───────────────────────────────────────────────────────────

  async verifyOtp(phone: string, otp: string, ipAddress?: string, userAgent?: string) {
    const storedOtp = await this.redis.getOtp(phone);
    if (!storedOtp || storedOtp !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const user = await this.prisma.user.findFirst({
      where: { phone, isActive: true },
      include: {
        userRoles: { include: { role: true } },
        employee: {
          include: { department: true, designation: true },
        },
      },
    });
    if (!user) throw new UnauthorizedException('Account not found');

    await this.redis.deleteOtp(phone);

    const organizationId = user.employee?.organizationId ?? '';
    return this.login(user.id, organizationId, ipAddress, userAgent);
  }

  // ── Refresh token ─────────────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const stored = await this.redis.getRefreshToken(payload.sub);
    if (!stored || stored !== refreshToken) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const tokens = await this.generateTokens(payload.sub, payload.email, payload.organizationId);
    await this.redis.saveRefreshToken(payload.sub, tokens.refreshToken, 30 * 24 * 60 * 60);

    return tokens;
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(userId: string) {
    await Promise.all([
      this.redis.deleteRefreshToken(userId),
      this.prisma.loginHistory.updateMany({
        where: { userId, logoutAt: null },
        data: { logoutAt: new Date() },
      }),
    ]);
    return { success: true, message: 'Logged out successfully' };
  }

  // ── Current user ──────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        employee: {
          include: { department: true, designation: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const permissions = user.userRoles.flatMap(
      (ur) => (ur.role.permissions as string[]) || [],
    );

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      organizationId: user.employee?.organizationId ?? null,
      permissions: [...new Set(permissions)],
      employee: user.employee
        ? {
            id: user.employee.id,
            empCode: user.employee.empCode,
            firstName: user.employee.firstName,
            lastName: user.employee.lastName,
            department: user.employee.department?.name ?? null,
            designation: user.employee.designation?.name ?? null,
          }
        : null,
    };
  }

  // ── Change password ───────────────────────────────────────────────────────

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.redis.deleteRefreshToken(userId);

    return { changed: true, message: 'Password changed successfully. Please log in again.' };
  }

  // ── Session management ────────────────────────────────────────────────────

  async getSessions(userId: string) {
    return this.prisma.loginHistory.findMany({
      where: { userId, logoutAt: null },
      orderBy: { loginAt: 'desc' },
      select: { id: true, ipAddress: true, userAgent: true, loginAt: true },
    });
  }

  async logoutAll(userId: string) {
    await Promise.all([
      this.redis.deleteRefreshToken(userId),
      this.prisma.loginHistory.updateMany({
        where: { userId, logoutAt: null },
        data: { logoutAt: new Date() },
      }),
    ]);
    return { success: true, message: 'Logged out from all devices' };
  }

  async logoutSession(userId: string, sessionId: string) {
    const session = await this.prisma.loginHistory.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.loginHistory.update({
      where: { id: sessionId },
      data: { logoutAt: new Date() },
    });
    return { success: true, message: 'Session terminated' };
  }

  // ── Register device token (FCM) ───────────────────────────────────────────

  async registerDeviceToken(userId: string, token: string, platform: string) {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
    return { registered: true, message: 'Device token registered for push notifications' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async generateTokens(userId: string, email: string, organizationId: string) {
    const payload = { sub: userId, email, organizationId };
    const expiresIn = this.config.get<string>('jwt.accessExpiresIn');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { expiresIn }),
      this.jwt.signAsync(payload, { expiresIn: this.config.get('jwt.refreshExpiresIn') }),
    ]);

    return { accessToken, refreshToken, expiresIn };
  }

  private async dispatchSms(phone: string, message: string) {
    const axios = (await import('axios')).default;
    await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: this.config.get('sms.fast2smsApiKey'),
        message,
        language: 'english',
        route: 'q',
        numbers: phone,
      },
    });
  }
}
