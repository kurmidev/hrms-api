import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { OrganizationId } from '@common/decorators/organization.decorator';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import {
  ApiCommonErrorResponses,
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from '@common/swagger/api-responses.decorator';
import { IncentiveRulesService } from './incentive-rules.service';
import { CreateIncentiveRuleDto } from './dto/create-incentive-rule.dto';
import { UpdateIncentiveRuleDto } from './dto/update-incentive-rule.dto';
import { QueryIncentiveRuleDto } from './dto/query-incentive-rule.dto';
import { IncentiveRuleResponseDto } from './dto/incentive-rule-response.dto';

@ApiTags('Incentives')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('incentive-rules')
export class IncentiveRulesController {
  constructor(private readonly incentiveRulesService: IncentiveRulesService) {}

  @Post()
  @RequirePermissions('incentive:manage')
  @ApiOperation({ summary: 'Create an incentive rule' })
  @ApiSuccessResponse(IncentiveRuleResponseDto, 'Incentive rule created', 201)
  create(@OrganizationId() organizationId: string, @Body() dto: CreateIncentiveRuleDto) {
    return this.incentiveRulesService.create(organizationId, dto);
  }

  @Get()
  @RequirePermissions('incentive:read')
  @ApiOperation({ summary: 'List incentive rules (paginated)' })
  @ApiPaginatedResponse(IncentiveRuleResponseDto, 'Paginated list of incentive rules')
  findAll(@OrganizationId() organizationId: string, @Query() query: QueryIncentiveRuleDto) {
    return this.incentiveRulesService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('incentive:read')
  @ApiOperation({ summary: 'Get a single incentive rule' })
  @ApiParam({ name: 'id', description: 'IncentiveRule UUID' })
  @ApiSuccessResponse(IncentiveRuleResponseDto, 'Incentive rule detail')
  findOne(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.incentiveRulesService.findOne(organizationId, id);
  }

  @Put(':id')
  @RequirePermissions('incentive:manage')
  @ApiOperation({ summary: 'Update an incentive rule' })
  @ApiParam({ name: 'id', description: 'IncentiveRule UUID' })
  @ApiSuccessResponse(IncentiveRuleResponseDto, 'Incentive rule updated')
  update(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIncentiveRuleDto,
  ) {
    return this.incentiveRulesService.update(organizationId, id, dto);
  }
}
