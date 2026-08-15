import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaginationDto, paginate } from '../../../common/dto/pagination.dto';
import { CreateWorkLocationDto } from './dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './dto/update-work-location.dto';
import { QueryWorkLocationDto } from './dto/query-work-location.dto';

const UNRECOGNIZED_LOCATION = 'Unrecognized Location';
const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lng points, in meters.
 * Deterministic and fully offline — no external geocoding dependency.
 */
function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

@Injectable()
export class WorkLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateWorkLocationDto) {
    const duplicate = await this.prisma.workLocation.findFirst({
      where: { organizationId, name: dto.name, deletedAt: null },
    });
    if (duplicate) {
      throw new ConflictException(
        `Work location "${dto.name}" already exists in this organization`,
      );
    }

    return this.prisma.workLocation.create({
      data: {
        organizationId,
        name: dto.name,
        lat: dto.lat,
        lng: dto.lng,
        radiusMeters: dto.radiusMeters,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(organizationId: string, query: QueryWorkLocationDto) {
    const pagination: PaginationDto = query;
    const where = {
      organizationId,
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [data, total] = await Promise.all([
      this.prisma.workLocation.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.workLocation.count({ where }),
    ]);

    return paginate(data, total, pagination);
  }

  async findOne(organizationId: string, id: string) {
    const location = await this.prisma.workLocation.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!location) throw new NotFoundException('Work location not found');
    return location;
  }

  async update(organizationId: string, id: string, dto: UpdateWorkLocationDto) {
    const location = await this.prisma.workLocation.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!location) throw new NotFoundException('Work location not found');

    if (dto.name && dto.name !== location.name) {
      const duplicate = await this.prisma.workLocation.findFirst({
        where: { organizationId, name: dto.name, id: { not: id }, deletedAt: null },
      });
      if (duplicate) {
        throw new ConflictException(
          `Work location "${dto.name}" already exists in this organization`,
        );
      }
    }

    return this.prisma.workLocation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
        ...(dto.radiusMeters !== undefined && { radiusMeters: dto.radiusMeters }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const location = await this.prisma.workLocation.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!location) throw new NotFoundException('Work location not found');

    await this.prisma.workLocation.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true, message: `Work location "${location.name}" deleted successfully` };
  }

  /**
   * Resolves a lat/lng pair to the nearest active work location's name for the
   * organization, if within that location's radiusMeters. Deterministic,
   * offline — no external geocoding calls.
   */
  async resolveLocationName(organizationId: string, lat: number, lng: number): Promise<string> {
    const locations = await this.prisma.workLocation.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
    });

    let nearestName: string | null = null;
    let nearestDistance = Infinity;

    for (const location of locations) {
      const distance = haversineDistanceMeters(lat, lng, location.lat, location.lng);
      if (distance <= location.radiusMeters && distance < nearestDistance) {
        nearestDistance = distance;
        nearestName = location.name;
      }
    }

    return nearestName ?? UNRECOGNIZED_LOCATION;
  }
}
