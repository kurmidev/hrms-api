import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request & { organizationId?: string }, res: Response, next: NextFunction) {
    const organizationId =
      (req.headers['x-organization-id'] as string) || (req.headers['x-tenant-id'] as string);

    if (organizationId) {
      req.organizationId = organizationId;
    }

    // Skip subscription check for platform and auth routes
    const path = req.path || '';
    const skipPaths = ['/platform', '/auth', '/api/v1/auth', '/api/v1/platform'];
    const shouldSkip = skipPaths.some((p) => path.startsWith(p));

    if (!shouldSkip && organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { isActive: true },
      });

      if (org && !org.isActive) {
        res.status(403).json({
          success: false,
          code: 'SUBSCRIPTION_SUSPENDED',
          message: 'Your organization subscription has been suspended.',
        });
        return;
      }
    }

    next();
  }
}
