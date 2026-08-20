import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationId } from '@common/decorators/organization.decorator';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import {
  ApiCommonErrorResponses,
  ApiSuccessResponse,
} from '@common/swagger/api-responses.decorator';
import { GreenThanksConfigService } from './green-thanks-config.service';
import { UpdateGreenThanksConfigDto } from './dto/update-green-thanks-config.dto';
import { GreenThanksConfigResponseDto } from './dto/green-thanks-config-response.dto';

@ApiTags('Green Thanks')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('green-thanks/config')
export class GreenThanksConfigController {
  constructor(private readonly greenThanksConfigService: GreenThanksConfigService) {}

  @Get()
  @RequirePermissions('green_thanks:manage')
  @ApiOperation({ summary: 'Get the organization Green Thanks config (upsert-on-read singleton)' })
  @ApiSuccessResponse(GreenThanksConfigResponseDto, 'Green Thanks config')
  get(@OrganizationId() organizationId: string) {
    return this.greenThanksConfigService.get(organizationId);
  }

  @Put()
  @RequirePermissions('green_thanks:manage')
  @ApiOperation({ summary: 'Update the organization Green Thanks config' })
  @ApiSuccessResponse(GreenThanksConfigResponseDto, 'Green Thanks config updated')
  update(@OrganizationId() organizationId: string, @Body() dto: UpdateGreenThanksConfigDto) {
    return this.greenThanksConfigService.update(organizationId, dto);
  }
}
