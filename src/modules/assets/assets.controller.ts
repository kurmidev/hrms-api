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
import { OrganizationId } from '@common/decorators/organization.decorator';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import {
  ApiCommonErrorResponses,
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from '@common/swagger/api-responses.decorator';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { QueryAssetDto } from './dto/query-asset.dto';
import { AssetResponseDto, AssetAssignmentHistoryResponseDto } from './dto/asset-response.dto';

@ApiTags('Assets')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequirePermissions('asset:read')
  @ApiOperation({ summary: 'List assets (paginated, org-scoped)' })
  @ApiPaginatedResponse(AssetResponseDto, 'Paginated list of assets')
  findAll(@OrganizationId() organizationId: string, @Query() query: QueryAssetDto) {
    return this.assetsService.findAll(organizationId, query);
  }

  @Get('employee/:employeeId/history')
  @RequirePermissions('asset:read')
  @ApiOperation({ summary: "Get an employee's full asset assignment history" })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiSuccessResponse(
    AssetAssignmentHistoryResponseDto,
    "Employee's asset assignment history (most recent first)",
  )
  findAssignmentsByEmployee(
    @OrganizationId() organizationId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.assetsService.findAssignmentsByEmployee(organizationId, employeeId);
  }

  @Get(':id')
  @RequirePermissions('asset:read')
  @ApiOperation({ summary: 'Get a single asset with its assignment history' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiSuccessResponse(AssetResponseDto, 'Asset detail')
  findOne(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.assetsService.findOne(organizationId, id);
  }

  @Post()
  @RequirePermissions('asset:assign')
  @ApiOperation({ summary: 'Create an asset master record' })
  @ApiSuccessResponse(AssetResponseDto, 'Asset created', 201)
  create(@OrganizationId() organizationId: string, @Body() dto: CreateAssetDto) {
    return this.assetsService.create(organizationId, dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('asset:assign')
  @ApiOperation({ summary: 'Edit an asset master record' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiSuccessResponse(AssetResponseDto, 'Asset updated')
  update(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.assetsService.update(organizationId, id, dto);
  }

  @Post(':id/assign')
  @RequirePermissions('asset:assign')
  @ApiOperation({
    summary: 'Assign an asset to an employee',
    description: 'Asset must be AVAILABLE. Creates a new open AssetAssignment record.',
  })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiSuccessResponse(AssetResponseDto, 'Asset assigned', 201)
  assign(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: AssignAssetDto,
  ) {
    return this.assetsService.assign(organizationId, id, dto);
  }

  @Put(':id/return')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('asset:return')
  @ApiOperation({
    summary: 'Return an asset',
    description:
      'Asset must be ASSIGNED with an open assignment. Closes the latest open assignment and ' +
      'sets the asset back to AVAILABLE (or newStatus). Re-assigning afterwards creates a new ' +
      'assignment row — history is never overwritten.',
  })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiSuccessResponse(AssetResponseDto, 'Asset returned')
  return(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: ReturnAssetDto,
  ) {
    return this.assetsService.return(organizationId, id, dto);
  }
}
