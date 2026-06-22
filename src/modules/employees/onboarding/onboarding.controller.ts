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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Generate onboarding invite link', description: 'Creates a secure onboarding link and dispatches SMS + email invite to the candidate.' })
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') hrUserId: string,
    @Body() dto: CreateOnboardingLinkDto,
  ) {
    return this.onboardingService.createLink(organizationId, hrUserId, dto);
  }

  @Get()
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List onboarding links', description: 'Paginated list. Filter by ?status=SUBMITTED.' })
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
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.onboardingService.findLinkById(organizationId, id);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Mark submission under review', description: 'Transitions SUBMITTED → UNDER_REVIEW.' })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
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
  @ApiOperation({ summary: 'Request corrections from candidate', description: 'Transitions UNDER_REVIEW → CHANGES_REQUESTED.' })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
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
  @ApiOperation({ summary: 'Reject onboarding submission', description: 'Transitions UNDER_REVIEW → REJECTED. Terminal state.' })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
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
    description: 'Combined approve and activate. HR must supply all 5 system assignments (department, designation, roles, payroll structure, leave policy). Creates the Employee and User records atomically, then sends the welcome email with temp credentials.',
  })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
  approve(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') hrUserId: string,
    @Param('id') id: string,
    @Body() dto: ApproveOnboardingDto,
  ) {
    return this.onboardingService.approve(organizationId, id, hrUserId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:delete')
  @ApiOperation({ summary: 'Revoke onboarding link', description: 'Marks a PENDING or IN_PROGRESS link as EXPIRED.' })
  @ApiParam({ name: 'id', description: 'Onboarding link UUID' })
  revoke(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') hrUserId: string,
    @Param('id') id: string,
  ) {
    return this.onboardingService.revokeLink(organizationId, id, hrUserId);
  }
}
