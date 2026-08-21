import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { OnboardingService } from './onboarding.service';
import { CreateOnboardingLinkDto } from '../dto/create-onboarding-link.dto';
import { RequestChangesDto } from '../dto/request-changes.dto';
import { ApproveOnboardingDto } from '../dto/approve-onboarding.dto';
import { OnboardingLinkQueryDto } from '../dto/onboarding-link-query.dto';

@ApiTags('Onboarding (HR)')
@ApiBearerAuth()
@Controller('onboarding-links')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post()
  @RequirePermissions('employee:create')
  @ApiOperation({
    summary: 'Generate onboarding invite link',
    description:
      'Creates a secure onboarding link and dispatches SMS + email invite to the candidate.',
  })
  @ApiResponse({ status: 201, description: 'Onboarding link created and invite dispatched' })
  @ApiResponse({ status: 400, description: 'Validation error in the request body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:create' })
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') hrUserId: string,
    @Body() dto: CreateOnboardingLinkDto,
  ) {
    return this.onboardingService.createLink(organizationId, hrUserId, dto);
  }

  @Get()
  @RequirePermissions('employee:read')
  @ApiOperation({
    summary: 'List onboarding links',
    description: 'Paginated list. Filter by ?status=SUBMITTED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated onboarding links',
    schema: {
      example: {
        success: true,
        message: 'Success',
        data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
        errorType: null,
        httpCode: 200,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:read' })
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: OnboardingLinkQueryDto,
  ) {
    return this.onboardingService.findLinks(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'Get onboarding link detail with transition history' })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
  @ApiResponse({ status: 200, description: 'Onboarding link detail with transition history' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:read' })
  @ApiResponse({ status: 404, description: 'Onboarding link not found in this organization' })
  findOne(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.onboardingService.findLinkById(organizationId, id);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:update')
  @ApiOperation({
    summary: 'Mark submission under review',
    description: 'Transitions SUBMITTED → UNDER_REVIEW.',
  })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
  @ApiResponse({ status: 200, description: 'Link transitioned to UNDER_REVIEW' })
  @ApiResponse({ status: 400, description: 'Link is not in a state that allows this transition' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:update' })
  @ApiResponse({ status: 404, description: 'Onboarding link not found in this organization' })
  markUnderReview(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') hrUserId: string,
    @Param('id') id: string,
  ) {
    return this.onboardingService.markUnderReview(organizationId, id, hrUserId);
  }

  @Post(':id/request-changes')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:update')
  @ApiOperation({
    summary: 'Request corrections from candidate',
    description: 'Transitions UNDER_REVIEW → CHANGES_REQUESTED.',
  })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
  @ApiResponse({ status: 200, description: 'Link transitioned to CHANGES_REQUESTED' })
  @ApiResponse({ status: 400, description: 'Link is not in a state that allows this transition' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:update' })
  @ApiResponse({ status: 404, description: 'Onboarding link not found in this organization' })
  requestChanges(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') hrUserId: string,
    @Param('id') id: string,
    @Body() dto: RequestChangesDto,
  ) {
    return this.onboardingService.requestChanges(organizationId, id, hrUserId, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:update')
  @ApiOperation({
    summary: 'Reject onboarding submission',
    description: 'Transitions UNDER_REVIEW → REJECTED. Terminal state.',
  })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
  @ApiResponse({ status: 200, description: 'Link transitioned to REJECTED' })
  @ApiResponse({ status: 400, description: 'Link is not in a state that allows this transition' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:update' })
  @ApiResponse({ status: 404, description: 'Onboarding link not found in this organization' })
  reject(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') hrUserId: string,
    @Param('id') id: string,
    @Body() dto: RequestChangesDto,
  ) {
    return this.onboardingService.reject(organizationId, id, hrUserId, dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:create')
  @ApiOperation({
    summary: 'Approve + Activate — creates Employee + User in one transaction',
    description:
      'Combined approve and activate. HR must supply all 5 system assignments (department, ' +
      'designation, roles, payroll structure, one or more leave policies via `leavePolicyIds`). ' +
      'The first entry in `leavePolicyIds` becomes the primary `Employee.leavePolicyId`; a ' +
      'LeaveBalance row is initialized for every listed policy. Creates the Employee and User ' +
      'records atomically, then sends the welcome email with temp credentials.',
  })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
  @ApiResponse({
    status: 200,
    description: 'Employee approved and activated; Employee + User records created',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error (e.g. empty leavePolicyIds), an id does not reference an active ' +
      'record in this organization, or the link is not in a state that allows approval',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:create' })
  @ApiResponse({ status: 404, description: 'Onboarding link not found in this organization' })
  approve(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') hrUserId: string,
    @Param('id') id: string,
    @Body() dto: ApproveOnboardingDto,
  ) {
    return this.onboardingService.approve(organizationId, id, hrUserId, dto);
  }

  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:create')
  @ApiOperation({
    summary: 'Resend onboarding invite',
    description:
      'Re-sends the invite email/SMS for a PENDING, IN_PROGRESS, or CHANGES_REQUESTED link, using the same token. Extends expiry by 7 days if the link has already expired.',
  })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
  @ApiResponse({ status: 200, description: 'Invite resent; updated onboarding link returned' })
  @ApiResponse({
    status: 400,
    description:
      'Link status does not allow resend (SUBMITTED, UNDER_REVIEW, ACTIVATED, REJECTED, or EXPIRED)',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:create' })
  @ApiResponse({ status: 404, description: 'Onboarding link not found in this organization' })
  resendInvite(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') hrUserId: string,
    @Param('id') id: string,
  ) {
    return this.onboardingService.resendInvite(organizationId, id, hrUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:delete')
  @ApiOperation({
    summary: 'Revoke onboarding link',
    description: 'Marks a PENDING or IN_PROGRESS link as EXPIRED.',
  })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
  @ApiResponse({ status: 200, description: 'Link revoked (marked EXPIRED)' })
  @ApiResponse({ status: 400, description: 'Link is not in a state that allows revocation' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: employee:delete' })
  @ApiResponse({ status: 404, description: 'Onboarding link not found in this organization' })
  revoke(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') hrUserId: string,
    @Param('id') id: string,
  ) {
    return this.onboardingService.revokeLink(organizationId, id, hrUserId);
  }
}
