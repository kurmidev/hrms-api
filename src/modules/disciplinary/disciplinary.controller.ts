import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { OrganizationId } from '@common/decorators/organization.decorator';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import {
  ApiCommonErrorResponses,
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from '@common/swagger/api-responses.decorator';
import { DisciplinaryService } from './disciplinary.service';
import { CreateDisciplinaryMemoDto } from './dto/create-disciplinary-memo.dto';
import { QueryDisciplinaryMemoDto } from './dto/query-disciplinary-memo.dto';
import { DisciplinaryMemoResponseDto } from './dto/disciplinary-memo-response.dto';
import { DisciplinaryEmployeeSummaryResponseDto } from './dto/disciplinary-employee-summary-response.dto';

@ApiTags('Disciplinary')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('disciplinary')
export class DisciplinaryController {
  constructor(private readonly disciplinaryService: DisciplinaryService) {}

  @Post()
  @RequirePermissions('exit:manage')
  @ApiOperation({
    summary: 'Issue a disciplinary memo',
    description:
      'Creates a memo for an employee. If this pushes the employee to 5+ active memos, the ' +
      'employee is flagged for termination review and HR/management is notified (flag + notify only).',
  })
  @ApiSuccessResponse(DisciplinaryMemoResponseDto, 'Disciplinary memo issued', 201)
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDisciplinaryMemoDto,
  ) {
    return this.disciplinaryService.create(organizationId, userId, dto);
  }

  @Get()
  @RequirePermissions('exit:manage')
  @ApiOperation({ summary: 'List disciplinary memos (paginated, filterable)' })
  @ApiPaginatedResponse(DisciplinaryMemoResponseDto, 'Paginated list of disciplinary memos')
  findAll(@OrganizationId() organizationId: string, @Query() query: QueryDisciplinaryMemoDto) {
    return this.disciplinaryService.findAll(organizationId, query);
  }

  @Get('employee/:employeeId/summary')
  @RequirePermissions('exit:manage')
  @ApiOperation({ summary: "Get an employee's active-memo count and termination-review flag" })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiSuccessResponse(DisciplinaryEmployeeSummaryResponseDto, 'Employee disciplinary summary')
  getEmployeeSummary(
    @OrganizationId() organizationId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.disciplinaryService.getEmployeeSummary(organizationId, employeeId);
  }

  @Get(':id')
  @RequirePermissions('exit:manage')
  @ApiOperation({ summary: 'Get a single disciplinary memo' })
  @ApiParam({ name: 'id', description: 'DisciplinaryMemo UUID' })
  @ApiSuccessResponse(DisciplinaryMemoResponseDto, 'Disciplinary memo detail')
  findOne(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.disciplinaryService.findOne(organizationId, id);
  }
}
