import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const MUST_CHANGE_EXEMPT_PATHS = ['/auth/change-password', '/auth/logout', '/auth/me', '/auth/refresh'];

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user, url } = context.switchToHttp().getRequest();

    if (!user) throw new ForbiddenException('Access denied');

    // Enforce password change gate
    if (user.mustChangePassword) {
      const path = (url as string).split('?')[0];
      const isExempt = MUST_CHANGE_EXEMPT_PATHS.some((exempt) => path.endsWith(exempt));
      if (!isExempt) {
        throw new ForbiddenException({ message: 'Password change required', code: 'MUST_CHANGE_PASSWORD' });
      }
    }

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const userPerms: string[] = user.permissions ?? [];
    if (userPerms.includes('*')) return true;

    const hasPermission = requiredPermissions.every((permission) =>
      userPerms.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
