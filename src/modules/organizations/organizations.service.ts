import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
