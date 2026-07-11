import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@prisma/prisma.service';

export interface PlatformJwtPayload {
  sub: string;
  email: string;
  type: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: any) => {
        const raw = req.headers['platform-authorization'] as string;
        if (!raw) return null;
        return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('PLATFORM_JWT_SECRET') || 'platform-secret',
    });
  }

  async validate(payload: PlatformJwtPayload) {
    if (payload.type !== 'platform') {
      throw new UnauthorizedException('Invalid token type');
    }

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: payload.sub },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Platform admin account is inactive or does not exist');
    }

    return admin;
  }
}
