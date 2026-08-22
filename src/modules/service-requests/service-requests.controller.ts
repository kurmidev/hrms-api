import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { OrganizationId } from '@common/decorators/organization.decorator';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import {
  ApiCommonErrorResponses,
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from '@common/swagger/api-responses.decorator';
import { ServiceRequestsService, RequestingUser } from './service-requests.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { AssignServiceRequestDto } from './dto/assign-service-request.dto';
import { ResolveServiceRequestDto } from './dto/resolve-service-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateServiceRequestCommentDto } from './dto/create-service-request-comment.dto';
import { QueryServiceRequestDto } from './dto/query-service-request.dto';
import {
  ServiceRequestResponseDto,
  ServiceRequestCommentResponseDto,
} from './dto/service-request-response.dto';

@ApiTags('Service Requests')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private readonly serviceRequestsService: ServiceRequestsService) {}

  @Get()
  @RequirePermissions('service_request:read')
  @ApiOperation({
    summary: 'List service requests (paginated)',
    description:
      'Regular employees (service_request:read only) see only their own requests. Managers ' +
      '(service_request:manage) see all requests for the organization.',
  })
  @ApiPaginatedResponse(ServiceRequestResponseDto, 'Paginated list of service requests')
  findAll(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Query() query: QueryServiceRequestDto,
  ) {
    return this.serviceRequestsService.findAll(organizationId, currentUser, query);
  }

  @Get('settings')
  @RequirePermissions('service_request:read')
  @ApiOperation({
    summary: 'Get service-request-related organization settings',
    description:
      'Lightweight read of allowAnonymousServiceRequests for the "Raise Request" form — ' +
      'usable by any service_request:read holder, unlike the full /organization endpoint ' +
      'which requires org:read.',
  })
  getSettings(@OrganizationId() organizationId: string) {
    return this.serviceRequestsService.getSettings(organizationId);
  }

  @Get(':id')
  @RequirePermissions('service_request:read')
  @ApiOperation({ summary: 'Get a single service request with its comment thread' })
  @ApiParam({ name: 'id', description: 'Service request UUID' })
  @ApiSuccessResponse(ServiceRequestResponseDto, 'Service request detail')
  findOne(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Param('id') id: string,
  ) {
    return this.serviceRequestsService.findOne(organizationId, currentUser, id);
  }

  @Post()
  @RequirePermissions('service_request:create')
  @ApiOperation({
    summary: 'Raise a service request',
    description:
      'SLA deadline is computed from priority (CRITICAL +24h, HIGH +48h, MEDIUM +72h, LOW ' +
      '+120h). COMPLIANCE category always escalates priority to at least HIGH.',
  })
  @ApiSuccessResponse(ServiceRequestResponseDto, 'Service request created', 201)
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Body() dto: CreateServiceRequestDto,
  ) {
    return this.serviceRequestsService.create(organizationId, currentUser, dto);
  }

  @Put(':id/assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('service_request:manage')
  @ApiOperation({
    summary: 'Assign (or reassign) a service request',
    description: 'OPEN → ASSIGNED. Reassignment allowed while ASSIGNED or IN_PROGRESS.',
  })
  @ApiParam({ name: 'id', description: 'Service request UUID' })
  @ApiSuccessResponse(ServiceRequestResponseDto, 'Service request assigned')
  assign(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: AssignServiceRequestDto,
  ) {
    return this.serviceRequestsService.assign(organizationId, id, dto);
  }

  @Put(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('service_request:manage')
  @ApiOperation({
    summary: 'Resolve a service request',
    description:
      'ASSIGNED or IN_PROGRESS → RESOLVED. Optional resolution note is added as a comment.',
  })
  @ApiParam({ name: 'id', description: 'Service request UUID' })
  @ApiSuccessResponse(ServiceRequestResponseDto, 'Service request resolved')
  resolve(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Param('id') id: string,
    @Body() dto: ResolveServiceRequestDto,
  ) {
    return this.serviceRequestsService.resolve(organizationId, id, currentUser, dto);
  }

  @Put(':id/grant-special-leave')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('service_request:manage')
  @ApiOperation({
    summary: 'Approve a SPECIAL_LEAVE service request and grant the leave',
    description:
      'Only valid for category=SPECIAL_LEAVE requests still OPEN/ASSIGNED/IN_PROGRESS. ' +
      'Creates an already-APPROVED, isSpecial=true LeaveApplication from the fields stored on ' +
      'the request (bypassing the normal balance-sufficiency check — this is a discretionary ' +
      'grant), still enforces holiday and overlapping-application checks, and marks the ' +
      'request RESOLVED with leaveApplicationId set. The regular /resolve endpoint refuses ' +
      'SPECIAL_LEAVE requests and points here instead.',
  })
  @ApiParam({ name: 'id', description: 'Service request UUID' })
  grantSpecialLeave(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Param('id') id: string,
  ) {
    return this.serviceRequestsService.grantSpecialLeave(
      organizationId,
      id,
      currentUser.id,
      currentUser.employeeId,
    );
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('service_request:manage')
  @ApiOperation({
    summary: 'Update service request status',
    description: 'Only ASSIGNED → IN_PROGRESS and RESOLVED → CLOSED are permitted here.',
  })
  @ApiParam({ name: 'id', description: 'Service request UUID' })
  @ApiSuccessResponse(ServiceRequestResponseDto, 'Service request status updated')
  updateStatus(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.serviceRequestsService.updateStatus(organizationId, id, dto);
  }

  @Post(':id/comments')
  @RequirePermissions('service_request:create')
  @ApiOperation({
    summary: 'Add a comment to a service request',
    description: 'Commenter must be the requester, the assignee, or a service request manager.',
  })
  @ApiParam({ name: 'id', description: 'Service request UUID' })
  @ApiSuccessResponse(ServiceRequestCommentResponseDto, 'Comment added', 201)
  addComment(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Param('id') id: string,
    @Body() dto: CreateServiceRequestCommentDto,
  ) {
    return this.serviceRequestsService.addComment(organizationId, id, currentUser, dto);
  }
}
