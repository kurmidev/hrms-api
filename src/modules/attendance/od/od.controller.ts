import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { OrganizationId } from '@common/decorators/organization.decorator';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import {
  ApiCommonErrorResponses,
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from '@common/swagger/api-responses.decorator';
import { OdService, RequestingUser } from './od.service';
import { CreateOdDto } from './dto/create-od.dto';
import { AddOdLocationDto } from './dto/add-od-location.dto';
import { QueryOdDto } from './dto/query-od.dto';
import { OdResponseDto } from './dto/od-response.dto';

@ApiTags('On Duty')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('attendance/od')
export class OdController {
  constructor(private readonly odService: OdService) {}

  @Post()
  @RequirePermissions('attendance:checkin')
  @ApiOperation({
    summary: "Mark on-duty (create today's OD record + first location entry)",
    description:
      "Creates (or appends to) the caller's OD record for today. GPS coordinates are " +
      'resolved to a work location name offline; minutes are added to the running total.',
  })
  @ApiSuccessResponse(OdResponseDto, 'OD record created/updated', 201)
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Body() dto: CreateOdDto,
  ) {
    return this.odService.create(organizationId, currentUser, dto);
  }

  @Post(':id/locations')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('attendance:checkin')
  @ApiOperation({
    summary: 'Append another on-duty location entry to an existing OD record',
    description: 'Appends a location + minutes entry and recomputes the OD record total minutes.',
  })
  @ApiParam({ name: 'id', description: 'OdRecord UUID' })
  @ApiSuccessResponse(OdResponseDto, 'Location entry added, total recomputed')
  addLocation(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Param('id') id: string,
    @Body() dto: AddOdLocationDto,
  ) {
    return this.odService.addLocation(organizationId, currentUser, id, dto);
  }

  @Get()
  // NOTE: no single @RequirePermissions() string can express "attendance:read OR
  // attendance:checkin" under PermissionsGuard's AND-only (.every()) semantics, and we
  // must reuse the existing permissions rather than invent a new one — so this route is
  // gated manually inside OdService.findAll(), which throws ForbiddenException if the
  // caller holds neither permission.
  @ApiOperation({
    summary: 'List OD records (paginated)',
    description:
      'Requires attendance:read (see all OD records in the organization, optionally ' +
      'filtered by ?employeeId=&date=) or attendance:checkin (self-only).',
  })
  @ApiPaginatedResponse(OdResponseDto, 'Paginated list of OD records')
  findAll(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Query() query: QueryOdDto,
  ) {
    return this.odService.findAll(organizationId, currentUser, query);
  }
}
