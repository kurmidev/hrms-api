import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformJwtStrategy } from './platform-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('PLATFORM_JWT_SECRET') || 'platform-secret',
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [PlatformAuthController],
  providers: [PlatformAuthService, PlatformJwtStrategy],
  exports: [PlatformAuthService, JwtModule],
})
export class PlatformAuthModule {}
