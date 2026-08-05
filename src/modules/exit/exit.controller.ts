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
import { ExitService } from './exit.service';
import { CreateExitDto } from './dto/create-exit.dto';
import { QueryExitDto } from './dto/query-exit.dto';
import { UpdateClearanceDto } from './dto/update-clearance.dto';
import { SettleExitDto } from './dto/settle-exit.dto';
import { ExitRecordResponseDto, ExitSettlementSummaryResponseDto } from './dto/exit-response.dto';

@ApiTags('Exit')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('exit')
export class ExitController {
  constructor(private readonly exitService: ExitService) {}

  @Post()
  @RequirePermissions('exit:manage')
  @ApiOperation({
    summary: 'Initiate an exit',
    description:
      'Creates an INITIATED exit record for an employee, seeding the department clearance ' +
      "checklist from the org's departments and computing a default target settlement date.",
  })
  @ApiSuccessResponse(ExitRecordResponseDto, 'Exit record initiated', 201)
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateExitDto,
  ) {
    return this.exitService.create(organizationId, userId, dto);
  }

  @Get()
  @RequirePermissions('exit:manage')
  @ApiOperation({ summary: 'List exit records (paginated, filterable)' })
  @ApiPaginatedResponse(ExitRecordResponseDto, 'Paginated list of exit records')
  findAll(@OrganizationId() organizationId: string, @Query() query: QueryExitDto) {
    return this.exitService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('exit:manage')
  @ApiOperation({ summary: 'Get a single exit record' })
  @ApiParam({ name: 'id', description: 'ExitRecord UUID' })
  @ApiSuccessResponse(ExitRecordResponseDto, 'Exit record detail')
  findOne(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.exitService.findOne(organizationId, id);
  }

  @Put(':id/clearance')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('exit:manage')
  @ApiOperation({
    summary: 'Update exit clearance checklist',
    description:
      'Updates department NOC / knowledge-transfer status, recomputes asset-handover status from ' +
      'the Assets module, and advances status to CLEARED once every condition is satisfied.',
  })
  @ApiParam({ name: 'id', description: 'ExitRecord UUID' })
  @ApiSuccessResponse(ExitRecordResponseDto, 'Clearance status updated')
  updateClearance(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateClearanceDto,
  ) {
    return this.exitService.updateClearance(organizationId, id, dto);
  }

  @Put(':id/settle')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('exit:manage')
  @ApiOperation({
    summary: 'Process final settlement',
    description:
      "Only permitted once the exit is CLEARED. References (does not recompute) the employee's " +
      'outstanding loan balance, records the settlement, and deactivates the employee (status EXITED).',
  })
  @ApiParam({ name: 'id', description: 'ExitRecord UUID' })
  @ApiSuccessResponse(ExitSettlementSummaryResponseDto, 'Exit settled')
  settle(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: SettleExitDto,
  ) {
    return this.exitService.settle(organizationId, userId, id, dto);
  }
}
