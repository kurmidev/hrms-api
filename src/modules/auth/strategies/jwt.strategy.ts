import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: { role: true },
        },
        employee: {
          include: {
            department: true,
            designation: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or does not exist');
    }

    // Flatten all permissions from all assigned roles
    const permissions = user.userRoles.flatMap(
      (ur) => (ur.role.permissions as string[]) || [],
    );

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      organizationId: payload.organizationId,
      mustChangePassword: user.mustChangePassword,
      permissions: [...new Set(permissions)],
      employee: user.employee
        ? {
            id: user.employee.id,
            empCode: user.employee.empCode,
            firstName: user.employee.firstName,
            lastName: user.employee.lastName,
            department: user.employee.department?.name,
            designation: user.employee.designation?.name,
          }
        : null,
    };
  }
}
