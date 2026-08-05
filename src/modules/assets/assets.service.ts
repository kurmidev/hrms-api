import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { QueryAssetDto } from './dto/query-asset.dto';

const ASSET_WITH_ASSIGNMENTS = {
  assignments: { orderBy: { assignedAt: 'desc' } },
} satisfies Prisma.AssetInclude;

type AssetPlain = Prisma.AssetGetPayload<object>;
type AssetWithAssignments = Prisma.AssetGetPayload<{ include: typeof ASSET_WITH_ASSIGNMENTS }>;

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateAssetDto) {
    const created = await this.prisma.asset.create({
      data: {
        organizationId,
        type: dto.type,
        name: dto.name,
        serialNumber: dto.serialNumber,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        purchaseValue: dto.purchaseValue,
      },
    });

    return this.toResponse(created);
  }

  async findAll(organizationId: string, query: QueryAssetDto) {
    const where: Prisma.AssetWhereInput = {
      organizationId,
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.asset.count({ where }),
    ]);

    return paginate(
      data.map((asset) => this.toResponse(asset)),
      total,
      query,
    );
  }

  async findOne(organizationId: string, id: string) {
    const asset = await this.getWithAssignmentsOrThrow(organizationId, id);
    return this.toResponse(asset, { includeAssignments: true });
  }

  async update(organizationId: string, id: string, dto: UpdateAssetDto) {
    await this.getOrThrow(organizationId, id);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
        ...(dto.purchaseDate !== undefined && {
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        }),
        ...(dto.purchaseValue !== undefined && { purchaseValue: dto.purchaseValue }),
      },
    });

    return this.toResponse(updated);
  }

  async assign(organizationId: string, id: string, dto: AssignAssetDto) {
    const asset = await this.getOrThrow(organizationId, id);

    if (asset.status !== AssetStatus.AVAILABLE) {
      throw new BadRequestException(
        `Asset is ${asset.status} and cannot be assigned (must be AVAILABLE)`,
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const [, updatedAsset] = await this.prisma.$transaction([
      this.prisma.assetAssignment.create({
        data: {
          assetId: id,
          employeeId: dto.employeeId,
          conditionOnIssue: dto.conditionOnIssue,
          notes: dto.notes,
        },
      }),
      this.prisma.asset.update({
        where: { id },
        data: { status: AssetStatus.ASSIGNED },
      }),
    ]);

    return this.toResponse(updatedAsset);
  }

  async return(organizationId: string, id: string, dto: ReturnAssetDto) {
    const asset = await this.getOrThrow(organizationId, id);

    if (asset.status !== AssetStatus.ASSIGNED) {
      throw new BadRequestException(
        `Asset is ${asset.status} and cannot be returned (must be ASSIGNED)`,
      );
    }

    const openAssignment = await this.prisma.assetAssignment.findFirst({
      where: { assetId: id, returnedAt: null },
      orderBy: { assignedAt: 'desc' },
    });
    if (!openAssignment) {
      throw new BadRequestException('No open assignment found for this asset');
    }

    const newStatus = dto.newStatus ?? AssetStatus.AVAILABLE;

    const [, updatedAsset] = await this.prisma.$transaction([
      this.prisma.assetAssignment.update({
        where: { id: openAssignment.id },
        data: {
          returnedAt: new Date(),
          conditionOnReturn: dto.conditionOnReturn,
          // A completed physical return via this endpoint IS the recovery event —
          // recoveredAtExit has no other writer anywhere in the codebase (see
          // rule §17), so leaving it false here would make Exit's asset-handover
          // check (`OR: [{returnedAt: null}, {recoveredAtExit: false}]`) permanently
          // unsatisfiable for any employee who was ever assigned an asset.
          recoveredAtExit: true,
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      }),
      this.prisma.asset.update({
        where: { id },
        data: { status: newStatus },
      }),
    ]);

    return this.toResponse(updatedAsset);
  }

  async findAssignmentsByEmployee(organizationId: string, employeeId: string) {
    if (!organizationId || !employeeId) {
      // Fail closed rather than feeding an undefined scope into the Prisma where (rule §12).
      throw new BadRequestException('organizationId and employeeId are required');
    }

    // The employee itself must belong to this org — otherwise a manager could probe
    // another org's employee UUIDs and learn (via an empty-but-200 response) that the
    // id simply has no assignments, rather than getting a clean 404 for "not in my org".
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const assignments = await this.prisma.assetAssignment.findMany({
      where: { employeeId, asset: { organizationId } },
      include: { asset: true },
      orderBy: { assignedAt: 'desc' },
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      assetId: assignment.assetId,
      employeeId: assignment.employeeId,
      assignedAt: assignment.assignedAt,
      returnedAt: assignment.returnedAt,
      conditionOnIssue: assignment.conditionOnIssue,
      conditionOnReturn: assignment.conditionOnReturn,
      approvedBy: assignment.approvedBy,
      notes: assignment.notes,
      recoveredAtExit: assignment.recoveredAtExit,
      recoveryNotes: assignment.recoveryNotes,
      asset: this.toResponse(assignment.asset),
    }));
  }

  /**
   * Consumed by ExitService when computing/enforcing asset-handover clearance.
   * Counts open AssetAssignments for the employee — either not yet returned
   * (`returnedAt` null) or returned but not yet recovered/reconciled at exit
   * (`recoveredAtExit` false).
   */
  async countUnreturnedAssignmentsForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<number> {
    if (!organizationId || !employeeId) {
      // Fail closed rather than feeding an undefined scope into the Prisma where (rule §12).
      throw new BadRequestException('organizationId and employeeId are required');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.assetAssignment.count({
      where: {
        employeeId,
        asset: { organizationId },
        OR: [{ returnedAt: null }, { recoveredAtExit: false }],
      },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async getOrThrow(organizationId: string, id: string): Promise<AssetPlain> {
    const asset = await this.prisma.asset.findFirst({ where: { id, organizationId } });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  private async getWithAssignmentsOrThrow(
    organizationId: string,
    id: string,
  ): Promise<AssetWithAssignments> {
    const asset = await this.prisma.asset.findFirst({
      where: { id, organizationId },
      include: ASSET_WITH_ASSIGNMENTS,
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  private toResponse(
    asset: AssetPlain | AssetWithAssignments,
    options: { includeAssignments?: boolean } = {},
  ) {
    const assignments =
      options.includeAssignments && 'assignments' in asset ? asset.assignments : undefined;

    return {
      id: asset.id,
      organizationId: asset.organizationId,
      type: asset.type,
      name: asset.name,
      serialNumber: asset.serialNumber,
      status: asset.status,
      purchaseDate: asset.purchaseDate,
      purchaseValue: asset.purchaseValue,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      ...(assignments && {
        assignments: assignments.map((a) => ({
          id: a.id,
          assetId: a.assetId,
          employeeId: a.employeeId,
          assignedAt: a.assignedAt,
          returnedAt: a.returnedAt,
          conditionOnIssue: a.conditionOnIssue,
          conditionOnReturn: a.conditionOnReturn,
          approvedBy: a.approvedBy,
          notes: a.notes,
          recoveredAtExit: a.recoveredAtExit,
          recoveryNotes: a.recoveryNotes,
        })),
      }),
    };
  }
}
