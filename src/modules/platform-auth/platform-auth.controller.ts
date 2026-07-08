import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformJwtAuthGuard } from './platform-jwt-auth.guard';
import { PlatformLoginDto } from './dto/platform-login.dto';

@Public()
@ApiTags('Platform Auth')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: PlatformLoginDto) {
    return this.platformAuthService.login(dto);
  }

  @ApiBearerAuth()
  @UseGuards(PlatformJwtAuthGuard)
  @Get('me')
  async me(@Request() req) {
    return this.platformAuthService.findById(req.user.id);
  }
}
