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
import { PerformanceService, RequestingUser } from './performance.service';
import { CreatePerformanceCycleDto } from './dto/create-performance-cycle.dto';
import { QueryPerformanceCycleDto } from './dto/query-performance-cycle.dto';
import { SubmitRatingDto } from './dto/submit-rating.dto';
import { QueryRatingDto } from './dto/query-rating.dto';
import { PerformanceCycleResponseDto } from './dto/performance-cycle-response.dto';
import { PerformanceRatingResponseDto } from './dto/performance-rating-response.dto';

@ApiTags('Performance')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Post('cycles')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'Create a performance cycle (DRAFT or ACTIVE, never CLOSED)' })
  @ApiSuccessResponse(PerformanceCycleResponseDto, 'Performance cycle created', 201)
  createCycle(@OrganizationId() organizationId: string, @Body() dto: CreatePerformanceCycleDto) {
    return this.performanceService.createCycle(organizationId, dto);
  }

  @Get('cycles')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List performance cycles (paginated, org-scoped)' })
  @ApiPaginatedResponse(PerformanceCycleResponseDto, 'Paginated list of performance cycles')
  findAllCycles(
    @OrganizationId() organizationId: string,
    @Query() query: QueryPerformanceCycleDto,
  ) {
    return this.performanceService.findAllCycles(organizationId, query);
  }

  @Get('my-ratings')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: "List the current user's own ratings across all cycles" })
  @ApiPaginatedResponse(PerformanceRatingResponseDto, "Paginated list of the caller's own ratings")
  findMyRatings(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Query() query: QueryRatingDto,
  ) {
    return this.performanceService.findMyRatings(organizationId, currentUser, query);
  }

  @Get('cycles/:id')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'Get a single performance cycle' })
  @ApiParam({ name: 'id', description: 'Performance cycle UUID' })
  @ApiSuccessResponse(PerformanceCycleResponseDto, 'Performance cycle detail')
  findOneCycle(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.performanceService.findOneCycle(organizationId, id);
  }

  @Put('cycles/:id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll:approve')
  @ApiOperation({ summary: 'Activate a DRAFT cycle so ratings can be submitted' })
  @ApiParam({ name: 'id', description: 'Performance cycle UUID' })
  @ApiSuccessResponse(PerformanceCycleResponseDto, 'Performance cycle activated (DRAFT → ACTIVE)')
  activateCycle(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.performanceService.activateCycle(organizationId, id);
  }

  @Put('cycles/:id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll:approve')
  @ApiOperation({ summary: 'Close an ACTIVE cycle, locking all ratings' })
  @ApiParam({ name: 'id', description: 'Performance cycle UUID' })
  @ApiSuccessResponse(PerformanceCycleResponseDto, 'Performance cycle closed (ACTIVE → CLOSED)')
  closeCycle(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.performanceService.closeCycle(organizationId, id);
  }

  @Post('cycles/:id/ratings')
  @RequirePermissions('employee:read')
  @ApiOperation({
    summary:
      'Submit or edit a rating for a subordinate (cycle must be ACTIVE; rater must be in the ' +
      "ratee's upward reporting chain)",
  })
  @ApiParam({ name: 'id', description: 'Performance cycle UUID' })
  @ApiSuccessResponse(PerformanceRatingResponseDto, 'Rating submitted or updated', 201)
  submitRating(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Param('id') id: string,
    @Body() dto: SubmitRatingDto,
  ) {
    return this.performanceService.submitRating(organizationId, id, currentUser, dto);
  }

  @Get('cycles/:id/ratings')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List ratings submitted for a cycle (paginated)' })
  @ApiParam({ name: 'id', description: 'Performance cycle UUID' })
  @ApiPaginatedResponse(PerformanceRatingResponseDto, 'Paginated list of ratings for the cycle')
  findRatings(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Query() query: QueryRatingDto,
  ) {
    return this.performanceService.findRatings(organizationId, id, query);
  }
}
