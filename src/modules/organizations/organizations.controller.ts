import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organization')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @RequirePermissions('org:read')
  @ApiOperation({ summary: 'Get organization profile', description: 'Returns the profile of the current organization.' })
  @ApiResponse({ status: 200, description: 'Organization profile', type: OrganizationResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: org:read' })
  findOne(@CurrentUser('organizationId') organizationId: string) {
    return this.organizationsService.findOne(organizationId);
  }

  @Put()
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Update organization profile', description: 'Updates the organization name, contact details, or logo URL. Slug and active status cannot be changed here.' })
  @ApiResponse({ status: 200, description: 'Organization updated', type: OrganizationResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or email collision' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: org:update' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(organizationId, dto);
  }
}
