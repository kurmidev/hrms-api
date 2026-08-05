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
import { InsuranceService } from './insurance.service';
import { CreateInsurancePolicyDto } from './dto/create-insurance-policy.dto';
import { UpdateInsurancePolicyDto } from './dto/update-insurance-policy.dto';
import { QueryInsurancePolicyDto } from './dto/query-insurance-policy.dto';
import { EnrollInsuranceDto } from './dto/enroll-insurance.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { ApproveEnrollmentDto } from './dto/approve-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { InsurancePolicyResponseDto } from './dto/insurance-policy-response.dto';
import { EmployeeInsuranceResponseDto } from './dto/employee-insurance-response.dto';

@ApiTags('Insurance')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('insurance')
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Get('policies')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List insurance policies (paginated, filterable)' })
  @ApiPaginatedResponse(InsurancePolicyResponseDto, 'Paginated list of insurance policies')
  listPolicies(@OrganizationId() organizationId: string, @Query() query: QueryInsurancePolicyDto) {
    return this.insuranceService.listPolicies(organizationId, query);
  }

  @Post('policies')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Create an insurance policy' })
  @ApiSuccessResponse(InsurancePolicyResponseDto, 'Insurance policy created', 201)
  createPolicy(@OrganizationId() organizationId: string, @Body() dto: CreateInsurancePolicyDto) {
    return this.insuranceService.createPolicy(organizationId, dto);
  }

  @Get('policies/:id')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'Get a single insurance policy' })
  @ApiParam({ name: 'id', description: 'InsurancePolicy UUID' })
  @ApiSuccessResponse(InsurancePolicyResponseDto, 'Insurance policy detail')
  getPolicy(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.insuranceService.getPolicy(organizationId, id);
  }

  @Put('policies/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Update an insurance policy' })
  @ApiParam({ name: 'id', description: 'InsurancePolicy UUID' })
  @ApiSuccessResponse(InsurancePolicyResponseDto, 'Insurance policy updated')
  updatePolicy(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInsurancePolicyDto,
  ) {
    return this.insuranceService.updatePolicy(organizationId, id, dto);
  }

  @Post('enroll')
  @RequirePermissions('employee:update')
  @ApiOperation({
    summary: 'Enroll an employee in a policy',
    description:
      'Creates a PENDING enrollment; family-member addition/enrollment is approval-based.',
  })
  @ApiSuccessResponse(EmployeeInsuranceResponseDto, 'Enrollment created (PENDING approval)', 201)
  enroll(@OrganizationId() organizationId: string, @Body() dto: EnrollInsuranceDto) {
    return this.insuranceService.enroll(organizationId, dto);
  }

  @Get('enrollments')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List insurance enrollments (paginated, filterable)' })
  @ApiPaginatedResponse(EmployeeInsuranceResponseDto, 'Paginated list of insurance enrollments')
  listEnrollments(@OrganizationId() organizationId: string, @Query() query: QueryEnrollmentDto) {
    return this.insuranceService.listEnrollments(organizationId, query);
  }

  @Get('enrollments/:id')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'Get a single insurance enrollment' })
  @ApiParam({ name: 'id', description: 'EmployeeInsurance UUID' })
  @ApiSuccessResponse(EmployeeInsuranceResponseDto, 'Insurance enrollment detail')
  getEnrollment(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.insuranceService.getEnrollment(organizationId, id);
  }

  @Put('enrollments/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: "Update an enrollment's family members" })
  @ApiParam({ name: 'id', description: 'EmployeeInsurance UUID' })
  @ApiSuccessResponse(EmployeeInsuranceResponseDto, 'Insurance enrollment updated')
  updateEnrollment(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    return this.insuranceService.updateEnrollment(organizationId, id, dto);
  }

  @Put('enrollments/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Approve or reject an insurance enrollment' })
  @ApiParam({ name: 'id', description: 'EmployeeInsurance UUID' })
  @ApiSuccessResponse(EmployeeInsuranceResponseDto, 'Insurance enrollment approval status updated')
  approveEnrollment(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ApproveEnrollmentDto,
  ) {
    return this.insuranceService.approveEnrollment(organizationId, userId, id, dto);
  }
}
