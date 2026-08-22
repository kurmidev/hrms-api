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
import { ZonesService } from './zones.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { QueryZoneDto } from './dto/query-zone.dto';
import { ZoneDeleteResponseDto, ZoneResponseDto } from './dto/zone-response.dto';

@ApiTags('Zones')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  @RequirePermissions('org:update')
  @ApiOperation({
    summary: 'Create zone',
    description:
      'Creates a lightweight zone tag used to group employees for zone-scoped GlobalLeave entries.',
  })
  @ApiSuccessResponse(ZoneResponseDto, 'Zone created', 201)
  create(@OrganizationId() organizationId: string, @Body() dto: CreateZoneDto) {
    return this.zonesService.create(organizationId, dto);
  }

  @Get()
  @RequirePermissions('org:read')
  @ApiOperation({ summary: 'List zones (paginated)' })
  @ApiPaginatedResponse(ZoneResponseDto, 'Paginated list of zones')
  findAll(@OrganizationId() organizationId: string, @Query() query: QueryZoneDto) {
    return this.zonesService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('org:read')
  @ApiOperation({ summary: 'Get a zone by ID' })
  @ApiParam({ name: 'id', description: 'Zone UUID' })
  @ApiSuccessResponse(ZoneResponseDto, 'Zone detail')
  findOne(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.zonesService.findOne(organizationId, id);
  }

  @Put(':id')
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Update a zone' })
  @ApiParam({ name: 'id', description: 'Zone UUID' })
  @ApiSuccessResponse(ZoneResponseDto, 'Zone updated')
  update(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto,
  ) {
    return this.zonesService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Soft-delete a zone' })
  @ApiParam({ name: 'id', description: 'Zone UUID' })
  @ApiSuccessResponse(ZoneDeleteResponseDto, 'Zone deleted')
  remove(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.zonesService.remove(organizationId, id);
  }
}
