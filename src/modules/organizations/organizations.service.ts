import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly config: ConfigService,
  ) {}

  async findOne(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(organizationId: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    if (dto.email && dto.email !== org.email) {
      const collision = await this.prisma.organization.findFirst({
        where: { email: dto.email, id: { not: organizationId } },
      });
      if (collision) throw new BadRequestException('Email is already used by another organization');
    }

    return this.prisma.organization.update({ where: { id: organizationId }, data: dto });
  }

  async uploadLogo(organizationId: string, file: Express.Multer.File) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, logoUrl: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const ext = extname(file.originalname);
    const key = `organizations/${organizationId}/logo${ext}`;
    const fileUrl = await this.files.upload(file.buffer, key, file.mimetype);

    // `updatedById` is NOT set here — PrismaService middleware auto-injects it
    // from the CLS-scoped JWT user on every write. Manually passing it here is
    // a documented anti-pattern (see hrms-backend.md rule #2).
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { logoUrl: fileUrl },
    });

    // Best-effort: delete old logo after DB update
    if (org.logoUrl) {
      const oldKey = this.extractFileKey(org.logoUrl);
      if (oldKey && oldKey !== key) {
        this.files.deleteFile(oldKey).catch(() => {});
      }
    }

    return updated;
  }

  // Same logic as `EmployeesService`'s `extractMinioKey` helper, extended to
  // also recognize the local-disk driver's `${appUrl}/uploads/${key}` URL
  // shape (see `FilesService.uploadLocal`) — both drivers may be active
  // depending on `STORAGE_DRIVER`.
  private extractFileKey(url: string): string | null {
    try {
      const appUrl = this.config.get<string>('appUrl');
      const localPrefix = `${appUrl}/uploads/`;
      if (url.includes(localPrefix)) {
        return url.substring(url.indexOf(localPrefix) + localPrefix.length);
      }

      const endpoint = this.config.get<string>('minio.endpoint');
      const port = this.config.get<number>('minio.port');
      const bucket = this.config.get<string>('minio.bucketName');
      const minioPrefix = `${endpoint}:${port}/${bucket}/`;
      if (url.includes(minioPrefix)) {
        return url.substring(url.indexOf(minioPrefix) + minioPrefix.length);
      }
      return null;
    } catch {
      return null;
    }
  }
}
