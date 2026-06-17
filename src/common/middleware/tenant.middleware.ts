import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request & { organizationId?: string }, _res: Response, next: NextFunction) {
    const organizationId =
      (req.headers['x-organization-id'] as string) ||
      (req.headers['x-tenant-id'] as string);

    if (organizationId) {
      req.organizationId = organizationId;
    }

    next();
  }
}
