import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const MUST_CHANGE_EXEMPT_PATHS = [
  '/auth/change-password',
  '/auth/logout',
  '/auth/me',
  '/auth/refresh',
];

// Same exemptions as the password-change gate below, plus none of the
// employee-scoped "act on the portal" routes — a PRE_BOARDING employee (their
// onboarding was approved, so a login exists, but HR has not yet activated
// them) must be able to log out / check their own status, nothing else.
const PENDING_ACTIVATION_EXEMPT_PATHS = [
  '/auth/change-password',
  '/auth/logout',
  '/auth/me',
  '/auth/refresh',
];

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
        throw new ForbiddenException({
          message: 'Password change required',
          code: 'MUST_CHANGE_PASSWORD',
        });
      }
    }

    // Enforce onboarding-activation gate: an employee whose onboarding was
    // approved (so their User/login exists) but who HR has not yet activated
    // (Employee.status still PRE_BOARDING) must not be able to take any
    // action anywhere in the portal until activation.
    if (user.employee?.status === 'PRE_BOARDING') {
      const path = (url as string).split('?')[0];
      const isExempt = PENDING_ACTIVATION_EXEMPT_PATHS.some((exempt) => path.endsWith(exempt));
      if (!isExempt) {
        throw new ForbiddenException({
          message: 'Your account is pending activation. Please contact HR.',
          code: 'ONBOARDING_NOT_ACTIVE',
        });
      }
    }

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const userPerms: string[] = user.permissions ?? [];
    if (userPerms.includes('*')) return true;

    const hasPermission = requiredPermissions.every((permission) => userPerms.includes(permission));

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
