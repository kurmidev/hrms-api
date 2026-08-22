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
import { LoansService, RequestingUser } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { QueryLoanDto } from './dto/query-loan.dto';
import { ApproveLoanDto } from './dto/approve-loan.dto';
import { RejectLoanDto } from './dto/reject-loan.dto';
import { LoanResponseDto } from './dto/loan-response.dto';
import { LoanEmiScheduleResponseDto } from './dto/loan-emi-schedule-response.dto';

@ApiTags('Loans')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @RequirePermissions('loan:apply')
  @ApiOperation({
    summary: 'Apply for a loan',
    description:
      'Creates a PENDING loan application for the caller’s own employee record, or on behalf of ' +
      'another employee if the caller holds loan:approve.',
  })
  @ApiSuccessResponse(LoanResponseDto, 'Loan application created', 201)
  apply(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Body() dto: CreateLoanDto,
  ) {
    return this.loansService.apply(organizationId, currentUser, dto);
  }

  @Get()
  @RequirePermissions('loan:read')
  @ApiOperation({
    summary: 'List loan applications (paginated)',
    description:
      'Users without loan:approve see only their own loan applications; users with loan:approve ' +
      'see all loans in the organization, optionally filtered by ?employeeId=&status=.',
  })
  @ApiPaginatedResponse(LoanResponseDto, 'Paginated list of loan applications')
  findAll(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Query() query: QueryLoanDto,
  ) {
    return this.loansService.findAll(organizationId, currentUser, query);
  }

  @Get(':id')
  @RequirePermissions('loan:read')
  @ApiOperation({ summary: 'Get a single loan application' })
  @ApiParam({ name: 'id', description: 'LoanApplication UUID' })
  @ApiSuccessResponse(LoanResponseDto, 'Loan application detail')
  findOne(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Param('id') id: string,
  ) {
    return this.loansService.findOne(organizationId, currentUser, id);
  }

  @Put(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('loan:approve')
  @ApiOperation({
    summary: 'Approve a PENDING loan application',
    description:
      'Sets the interest rate and approved amount/tenure, generates the amortization EMI schedule, ' +
      'and transitions the loan directly to ACTIVE (disbursed).',
  })
  @ApiParam({ name: 'id', description: 'LoanApplication UUID' })
  @ApiSuccessResponse(LoanResponseDto, 'Loan approved, EMI schedule generated')
  approve(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('employeeId') approverEmployeeId: string,
    @Param('id') id: string,
    @Body() dto: ApproveLoanDto,
  ) {
    return this.loansService.approve(organizationId, userId, approverEmployeeId, id, dto);
  }

  @Put(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('loan:approve')
  @ApiOperation({ summary: 'Reject a PENDING loan application' })
  @ApiParam({ name: 'id', description: 'LoanApplication UUID' })
  @ApiSuccessResponse(LoanResponseDto, 'Loan application rejected')
  reject(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('employeeId') approverEmployeeId: string,
    @Param('id') id: string,
    @Body() dto: RejectLoanDto,
  ) {
    return this.loansService.reject(organizationId, userId, approverEmployeeId, id, dto);
  }

  @Get(':id/emi-schedule')
  @RequirePermissions('loan:read')
  @ApiOperation({ summary: 'Get the amortization EMI schedule for a loan' })
  @ApiParam({ name: 'id', description: 'LoanApplication UUID' })
  @ApiSuccessResponse(LoanEmiScheduleResponseDto, 'Ordered EMI schedule', 200)
  getEmiSchedule(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Param('id') id: string,
  ) {
    return this.loansService.getEmiSchedule(organizationId, currentUser, id);
  }
}
