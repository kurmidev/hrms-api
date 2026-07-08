import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@prisma/prisma.service';
import { PlatformLoginDto } from './dto/platform-login.dto';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: PlatformLoginDto) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: dto.email },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.jwt.sign({
      sub: admin.id,
      type: 'platform',
      email: admin.email,
    });

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        isActive: admin.isActive,
      },
    };
  }

  async findById(id: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return admin;
  }
}
