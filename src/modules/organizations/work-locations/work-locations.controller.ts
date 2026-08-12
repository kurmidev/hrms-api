import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { OrganizationId } from '@common/decorators/organization.decorator';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import {
  ApiCommonErrorResponses,
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from '@common/swagger/api-responses.decorator';
import { WorkLocationsService } from './work-locations.service';
import { CreateWorkLocationDto } from './dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './dto/update-work-location.dto';
import { QueryWorkLocationDto } from './dto/query-work-location.dto';
import {
  WorkLocationDeleteResponseDto,
  WorkLocationResponseDto,
} from './dto/work-location-response.dto';

@ApiTags('Work Locations')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('work-locations')
export class WorkLocationsController {
  constructor(private readonly workLocationsService: WorkLocationsService) {}

  @Post()
  @RequirePermissions('org:update')
  @ApiOperation({
    summary: 'Create work location',
    description:
      'Creates a named geo-fenced work location used to resolve offline GPS ' +
      'check-in/check-out and OD coordinates to a human-readable name.',
  })
  @ApiSuccessResponse(WorkLocationResponseDto, 'Work location created', 201)
  create(@OrganizationId() organizationId: string, @Body() dto: CreateWorkLocationDto) {
    return this.workLocationsService.create(organizationId, dto);
  }

  @Get()
  @RequirePermissions('org:read')
  @ApiOperation({ summary: 'List work locations (paginated)' })
  @ApiPaginatedResponse(WorkLocationResponseDto, 'Paginated list of work locations')
  findAll(@OrganizationId() organizationId: string, @Query() query: QueryWorkLocationDto) {
    return this.workLocationsService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('org:read')
  @ApiOperation({ summary: 'Get a work location by ID' })
  @ApiParam({ name: 'id', description: 'WorkLocation UUID' })
  @ApiSuccessResponse(WorkLocationResponseDto, 'Work location detail')
  findOne(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.workLocationsService.findOne(organizationId, id);
  }

  @Put(':id')
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Update a work location' })
  @ApiParam({ name: 'id', description: 'WorkLocation UUID' })
  @ApiSuccessResponse(WorkLocationResponseDto, 'Work location updated')
  update(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkLocationDto,
  ) {
    return this.workLocationsService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Soft-delete a work location' })
  @ApiParam({ name: 'id', description: 'WorkLocation UUID' })
  @ApiSuccessResponse(WorkLocationDeleteResponseDto, 'Work location deleted')
  remove(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.workLocationsService.remove(organizationId, id);
  }
}
