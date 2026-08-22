import {
  Body,
  Controller,
  Delete,
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
import { QueryHolidaysDto } from './dto/query-holidays.dto';
import { QueryLeaveBalanceDto } from './dto/query-leave-balance.dto';
import { LeavePoliciesService } from './leave-policies.service';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveApplicationsService } from './leave-applications.service';
import { HolidaysService } from './holidays.service';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import { QueryLeavePolicyDto } from './dto/query-leave-policy.dto';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { QueryLeaveDto } from './dto/query-leave.dto';
import { ApproveLeaveDto, RejectLeaveDto } from './dto/decide-leave.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

@ApiTags('Leave')
@ApiBearerAuth()
@Controller('leave')
export class LeaveController {
  constructor(
    private readonly leavePoliciesService: LeavePoliciesService,
    private readonly leaveBalanceService: LeaveBalanceService,
    private readonly leaveApplicationsService: LeaveApplicationsService,
    private readonly holidaysService: HolidaysService,
  ) {}

  // ─── Leave Policies ───────────────────────────────────────────────────────

  @Get('policies')
  @RequirePermissions('leave:read')
  @ApiOperation({ summary: 'List leave policies' })
  findAllPolicies(@OrganizationId() organizationId: string, @Query() query: QueryLeavePolicyDto) {
    return this.leavePoliciesService.findAll(organizationId, query);
  }

  @Post('policies')
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Create a leave policy' })
  createPolicy(@OrganizationId() organizationId: string, @Body() dto: CreateLeavePolicyDto) {
    return this.leavePoliciesService.create(organizationId, dto);
  }

  @Put('policies/:id')
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Update a leave policy' })
  @ApiParam({ name: 'id', description: 'Leave policy UUID' })
  updatePolicy(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeavePolicyDto,
  ) {
    return this.leavePoliciesService.update(organizationId, id, dto);
  }

  @Put('policies/:id/toggle')
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Toggle a leave policy active/inactive' })
  @ApiParam({ name: 'id', description: 'Leave policy UUID' })
  togglePolicy(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.leavePoliciesService.toggle(organizationId, id);
  }

  // ─── Balances ─────────────────────────────────────────────────────────────

  @Get('balances')
  @RequirePermissions('leave:read')
  @ApiOperation({ summary: 'List leave balances (HR view, paginated)' })
  getBalances(@OrganizationId() organizationId: string, @Query() query: QueryLeaveBalanceDto) {
    return this.leaveBalanceService.getBalances(organizationId, query);
  }

  @Get('my-balance')
  @RequirePermissions('leave:apply')
  @ApiOperation({ summary: 'Get my own leave balances for the current year' })
  getMyBalance(
    @OrganizationId() organizationId: string,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.leaveBalanceService.getMyBalance(organizationId, employeeId);
  }

  // ─── Applications ─────────────────────────────────────────────────────────

  @Get('my')
  @RequirePermissions('leave:apply')
  @ApiOperation({ summary: 'List my own leave applications' })
  myApplications(
    @OrganizationId() organizationId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Query() query: QueryLeaveDto,
  ) {
    return this.leaveApplicationsService.myApplications(organizationId, employeeId, query);
  }

  @Post('apply')
  @RequirePermissions('leave:apply')
  @ApiOperation({ summary: 'Apply for leave' })
  apply(
    @OrganizationId() organizationId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() dto: ApplyLeaveDto,
  ) {
    return this.leaveApplicationsService.apply(organizationId, employeeId, dto);
  }

  @Get()
  @RequirePermissions('leave:read')
  @ApiOperation({ summary: 'List leave applications (HR/manager view, paginated)' })
  findAll(@OrganizationId() organizationId: string, @Query() query: QueryLeaveDto) {
    return this.leaveApplicationsService.findAll(organizationId, query);
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('leave:apply')
  @ApiOperation({ summary: 'Cancel my own pending leave application' })
  @ApiParam({ name: 'id', description: 'LeaveApplication UUID' })
  cancel(
    @OrganizationId() organizationId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Param('id') id: string,
  ) {
    return this.leaveApplicationsService.cancel(organizationId, employeeId, id);
  }

  @Put(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('leave:approve')
  @ApiOperation({ summary: 'Approve a pending leave application' })
  @ApiParam({ name: 'id', description: 'LeaveApplication UUID' })
  approve(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('employeeId') approverEmployeeId: string,
    @Param('id') id: string,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.leaveApplicationsService.approve(
      organizationId,
      id,
      userId,
      approverEmployeeId,
      dto,
    );
  }

  @Put(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('leave:approve')
  @ApiOperation({ summary: 'Reject a pending leave application' })
  @ApiParam({ name: 'id', description: 'LeaveApplication UUID' })
  reject(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('employeeId') approverEmployeeId: string,
    @Param('id') id: string,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.leaveApplicationsService.reject(
      organizationId,
      id,
      userId,
      approverEmployeeId,
      dto,
    );
  }

  // ─── Holidays ─────────────────────────────────────────────────────────────

  @Get('holidays')
  @RequirePermissions('leave:read')
  @ApiOperation({ summary: 'List organization holidays' })
  findAllHolidays(@OrganizationId() organizationId: string, @Query() query: QueryHolidaysDto) {
    return this.holidaysService.findAll(organizationId, query);
  }

  @Post('holidays')
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Create a holiday' })
  createHoliday(@OrganizationId() organizationId: string, @Body() dto: CreateHolidayDto) {
    return this.holidaysService.create(organizationId, dto);
  }

  @Put('holidays/:id')
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Update a holiday' })
  @ApiParam({ name: 'id', description: 'Holiday UUID' })
  updateHoliday(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.holidaysService.update(organizationId, id, dto);
  }

  @Delete('holidays/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('org:update')
  @ApiOperation({ summary: 'Delete a holiday' })
  @ApiParam({ name: 'id', description: 'Holiday UUID' })
  deleteHoliday(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.holidaysService.delete(organizationId, id);
  }
}
