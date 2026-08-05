import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '@common/dto/pagination.dto';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { AssignServiceRequestDto } from './dto/assign-service-request.dto';
import { ResolveServiceRequestDto } from './dto/resolve-service-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateServiceRequestCommentDto } from './dto/create-service-request-comment.dto';
import { QueryServiceRequestDto } from './dto/query-service-request.dto';

export const SERVICE_REQUEST_MANAGE_PERMISSION = 'service_request:manage';

export interface RequestingUser {
  id: string;
  employeeId: string | null;
  permissions: string[];
}

const SR_WITH_EMPLOYEE = {
  employee: {
    select: { id: true, empCode: true, firstName: true, lastName: true },
  },
} satisfies Prisma.ServiceRequestInclude;

const SR_WITH_COMMENTS = {
  ...SR_WITH_EMPLOYEE,
  comments: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ServiceRequestInclude;

type SrWithEmployee = Prisma.ServiceRequestGetPayload<{ include: typeof SR_WITH_EMPLOYEE }>;
type SrWithComments = Prisma.ServiceRequestGetPayload<{ include: typeof SR_WITH_COMMENTS }>;

const SLA_HOURS_BY_PRIORITY: Record<ServiceRequestPriority, number> = {
  [ServiceRequestPriority.CRITICAL]: 24,
  [ServiceRequestPriority.HIGH]: 48,
  [ServiceRequestPriority.MEDIUM]: 72,
  [ServiceRequestPriority.LOW]: 120,
};

const PRIORITY_RANK: Record<ServiceRequestPriority, number> = {
  [ServiceRequestPriority.LOW]: 0,
  [ServiceRequestPriority.MEDIUM]: 1,
  [ServiceRequestPriority.HIGH]: 2,
  [ServiceRequestPriority.CRITICAL]: 3,
};

@Injectable()
export class ServiceRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private canManage(currentUser: RequestingUser): boolean {
    return (
      currentUser.permissions.includes(SERVICE_REQUEST_MANAGE_PERMISSION) ||
      currentUser.permissions.includes('*')
    );
  }

  /** COMPLIANCE requests are always escalated to at least HIGH priority. */
  private resolvePriority(
    category: ServiceRequestCategory,
    requested?: ServiceRequestPriority,
  ): ServiceRequestPriority {
    const base = requested ?? ServiceRequestPriority.MEDIUM;
    if (category !== ServiceRequestCategory.COMPLIANCE) return base;

    return PRIORITY_RANK[base] >= PRIORITY_RANK[ServiceRequestPriority.HIGH]
      ? base
      : ServiceRequestPriority.HIGH;
  }

  private computeSlaDeadline(priority: ServiceRequestPriority, from: Date = new Date()): Date {
    const hours = SLA_HOURS_BY_PRIORITY[priority];
    return new Date(from.getTime() + hours * 60 * 60 * 1000);
  }

  /**
   * Lightweight settings read for the "Raise Request" form (anonymous checkbox gating).
   * Deliberately NOT the full `/organization` endpoint — that requires `org:read`, which
   * regular requesters (service_request:read/:create only) do not have. Every user who can
   * see the service-requests page must be able to know whether anonymous is allowed.
   */
  async getSettings(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { allowAnonymousServiceRequests: true },
    });
    return { allowAnonymousServiceRequests: org?.allowAnonymousServiceRequests ?? false };
  }

  async create(organizationId: string, currentUser: RequestingUser, dto: CreateServiceRequestDto) {
    const isAnonymous = dto.isAnonymous ?? false;

    if (isAnonymous) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { allowAnonymousServiceRequests: true },
      });
      if (!org?.allowAnonymousServiceRequests) {
        throw new BadRequestException(
          'Anonymous service requests are disabled for this organization',
        );
      }
    }

    const priority = this.resolvePriority(dto.category, dto.priority);
    const slaDeadline = this.computeSlaDeadline(priority);

    const created = await this.prisma.serviceRequest.create({
      data: {
        organizationId,
        employeeId: isAnonymous ? null : currentUser.employeeId,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        priority,
        slaDeadline,
        isAnonymous,
      },
      include: SR_WITH_EMPLOYEE,
    });

    return this.toResponse(created);
  }

  async findAll(
    organizationId: string,
    currentUser: RequestingUser,
    query: QueryServiceRequestDto,
  ) {
    const manages = this.canManage(currentUser);

    if (!manages && !currentUser.employeeId) {
      // Fail closed rather than feeding an undefined scope into the Prisma where (rule §12).
      return paginate([], 0, query);
    }

    const where: Prisma.ServiceRequestWhereInput = {
      organizationId,
      ...(!manages && { employeeId: currentUser.employeeId }),
      ...(query.status && { status: query.status }),
      ...(query.category && { category: query.category }),
      ...(query.priority && { priority: query.priority }),
      ...(query.assignedTo && { assignedTo: query.assignedTo }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.serviceRequest.findMany({
        where,
        include: SR_WITH_EMPLOYEE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);

    return paginate(
      data.map((sr) => this.toResponse(sr)),
      total,
      query,
    );
  }

  async findOne(organizationId: string, currentUser: RequestingUser, id: string) {
    const sr = await this.getWithCommentsOrThrow(organizationId, id);

    if (!this.canManage(currentUser) && sr.employeeId !== currentUser.employeeId) {
      throw new NotFoundException('Service request not found');
    }

    return this.toResponse(sr, { includeComments: true });
  }

  async assign(organizationId: string, id: string, dto: AssignServiceRequestDto) {
    const sr = await this.getOrThrow(organizationId, id);

    const isFreshAssign = sr.status === ServiceRequestStatus.OPEN;
    const isReassign =
      sr.status === ServiceRequestStatus.ASSIGNED || sr.status === ServiceRequestStatus.IN_PROGRESS;

    if (!isFreshAssign && !isReassign) {
      throw new BadRequestException(`Cannot assign a service request in ${sr.status} status`);
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        assignedTo: dto.assignedTo,
        status: isFreshAssign ? ServiceRequestStatus.ASSIGNED : sr.status,
        ...(dto.slaDeadline && { slaDeadline: new Date(dto.slaDeadline) }),
      },
      include: SR_WITH_EMPLOYEE,
    });

    return this.toResponse(updated);
  }

  async resolve(
    organizationId: string,
    id: string,
    currentUser: RequestingUser,
    dto: ResolveServiceRequestDto,
  ) {
    const sr = await this.getOrThrow(organizationId, id);

    const canResolve =
      sr.status === ServiceRequestStatus.ASSIGNED || sr.status === ServiceRequestStatus.IN_PROGRESS;
    if (!canResolve) {
      throw new BadRequestException(`Cannot resolve a service request in ${sr.status} status`);
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: { status: ServiceRequestStatus.RESOLVED, resolvedAt: new Date() },
      include: SR_WITH_EMPLOYEE,
    });

    if (dto.resolutionNote) {
      await this.prisma.serviceRequestComment.create({
        data: {
          serviceRequestId: id,
          authorId: currentUser.id,
          content: dto.resolutionNote,
        },
      });
    }

    return this.toResponse(updated);
  }

  async updateStatus(organizationId: string, id: string, dto: UpdateStatusDto) {
    const sr = await this.getOrThrow(organizationId, id);

    const validTransition =
      (sr.status === ServiceRequestStatus.ASSIGNED &&
        dto.status === ServiceRequestStatus.IN_PROGRESS) ||
      (sr.status === ServiceRequestStatus.RESOLVED && dto.status === ServiceRequestStatus.CLOSED);

    if (!validTransition) {
      throw new BadRequestException(
        `Cannot transition a service request from ${sr.status} to ${dto.status}`,
      );
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === ServiceRequestStatus.CLOSED && { closedAt: new Date() }),
      },
      include: SR_WITH_EMPLOYEE,
    });

    return this.toResponse(updated);
  }

  async addComment(
    organizationId: string,
    id: string,
    currentUser: RequestingUser,
    dto: CreateServiceRequestCommentDto,
  ) {
    const sr = await this.getOrThrow(organizationId, id);

    const isRequester = Boolean(currentUser.employeeId) && sr.employeeId === currentUser.employeeId;
    const isAssignee = Boolean(sr.assignedTo) && sr.assignedTo === currentUser.id;

    if (!isRequester && !isAssignee && !this.canManage(currentUser)) {
      throw new ForbiddenException(
        'Only the requester, the assignee, or a service request manager can comment',
      );
    }

    const comment = await this.prisma.serviceRequestComment.create({
      data: {
        serviceRequestId: id,
        authorId: currentUser.id,
        content: dto.content,
      },
    });

    return {
      id: comment.id,
      serviceRequestId: comment.serviceRequestId,
      authorId: comment.authorId,
      content: comment.content,
      createdAt: comment.createdAt,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async getOrThrow(organizationId: string, id: string) {
    const sr = await this.prisma.serviceRequest.findFirst({ where: { id, organizationId } });
    if (!sr) throw new NotFoundException('Service request not found');
    return sr;
  }

  private async getWithCommentsOrThrow(
    organizationId: string,
    id: string,
  ): Promise<SrWithComments> {
    const sr = await this.prisma.serviceRequest.findFirst({
      where: { id, organizationId },
      include: SR_WITH_COMMENTS,
    });
    if (!sr) throw new NotFoundException('Service request not found');
    return sr;
  }

  private toResponse(
    sr: SrWithEmployee | SrWithComments,
    options: { includeComments?: boolean } = {},
  ) {
    const comments = options.includeComments && 'comments' in sr ? sr.comments : undefined;

    return {
      id: sr.id,
      organizationId: sr.organizationId,
      employeeId: sr.employeeId,
      employee: sr.employee
        ? {
            id: sr.employee.id,
            empCode: sr.employee.empCode,
            firstName: sr.employee.firstName,
            lastName: sr.employee.lastName,
          }
        : null,
      category: sr.category,
      title: sr.title,
      description: sr.description,
      priority: sr.priority,
      status: sr.status,
      assignedTo: sr.assignedTo,
      slaDeadline: sr.slaDeadline,
      isAnonymous: sr.isAnonymous,
      resolvedAt: sr.resolvedAt,
      closedAt: sr.closedAt,
      createdAt: sr.createdAt,
      updatedAt: sr.updatedAt,
      ...(comments && {
        comments: comments.map((c) => ({
          id: c.id,
          serviceRequestId: c.serviceRequestId,
          authorId: c.authorId,
          content: c.content,
          createdAt: c.createdAt,
        })),
      }),
    };
  }
}
