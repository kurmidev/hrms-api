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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { OrganizationId } from '@common/decorators/organization.decorator';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AttendanceService } from './attendance.service';
import { CheckInDto, LiveLocationDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { ManualEntryDto } from './dto/manual-entry.dto';
import { CorrectionRequestDto } from './dto/correction-request.dto';
import { ApproveCorrectionDto } from './dto/approve-correction.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @RequirePermissions('attendance:checkin')
  @ApiOperation({ summary: 'Check in for the day (GPS)' })
  checkIn(
    @OrganizationId() organizationId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.attendanceService.checkIn(organizationId, employeeId, dto);
  }

  @Post('check-out')
  @RequirePermissions('attendance:checkin')
  @ApiOperation({ summary: 'Check out for the day (GPS)' })
  checkOut(
    @OrganizationId() organizationId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() dto: CheckOutDto,
  ) {
    return this.attendanceService.checkOut(organizationId, employeeId, dto);
  }

  @Post('live-location')
  @RequirePermissions('attendance:checkin')
  @ApiOperation({ summary: 'Push a live GPS location update' })
  liveUpdate(
    @OrganizationId() organizationId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() dto: LiveLocationDto,
  ) {
    return this.attendanceService.liveUpdate(organizationId, employeeId, dto);
  }

  @Get('live')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'Get latest live location for every employee' })
  getLiveLocations(@OrganizationId() organizationId: string) {
    return this.attendanceService.getLiveLocations(organizationId);
  }

  @Post('manual')
  @RequirePermissions('attendance:correct')
  @ApiOperation({ summary: 'Create/overwrite an attendance entry manually (HR)' })
  manualEntry(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ManualEntryDto,
  ) {
    return this.attendanceService.manualEntry(organizationId, dto, userId);
  }

  @Post('import')
  @RequirePermissions('attendance:correct')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import attendance from CSV',
    description: 'CSV columns: empCode,date,checkInAt,checkOutAt,status,notes',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  bulkImport(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.attendanceService.bulkImport(organizationId, file, userId);
  }

  @Post('correction-request')
  @RequirePermissions('attendance:checkin')
  @ApiOperation({ summary: 'Request a correction to a past attendance entry' })
  requestCorrection(
    @OrganizationId() organizationId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() dto: CorrectionRequestDto,
  ) {
    return this.attendanceService.requestCorrection(organizationId, employeeId, dto);
  }

  @Put('correction/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('attendance:correct')
  @ApiOperation({ summary: 'Approve/apply a correction request' })
  @ApiParam({ name: 'id', description: 'AttendanceLog UUID' })
  approveCorrection(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('employeeId') approverEmployeeId: string,
    @Param('id') id: string,
    @Body() dto: ApproveCorrectionDto,
  ) {
    return this.attendanceService.approveCorrection(
      organizationId,
      id,
      dto,
      userId,
      approverEmployeeId,
    );
  }

  @Get('my')
  @RequirePermissions('attendance:checkin')
  @ApiOperation({ summary: 'Get my own attendance history' })
  getMyAttendance(
    @OrganizationId() organizationId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Query() query: QueryAttendanceDto,
  ) {
    return this.attendanceService.getMyAttendance(organizationId, employeeId, query);
  }

  @Get()
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'List attendance logs (paginated)' })
  findAll(@OrganizationId() organizationId: string, @Query() query: QueryAttendanceDto) {
    return this.attendanceService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'Get a single attendance log' })
  @ApiParam({ name: 'id', description: 'AttendanceLog UUID' })
  findOne(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.attendanceService.findOne(organizationId, id);
  }
}
