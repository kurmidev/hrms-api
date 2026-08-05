import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Get,
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
import { GreenThanksService, RequestingUser } from './green-thanks.service';
import { CreateGreenThanksDto } from './dto/create-green-thanks.dto';
import { ApproveGreenThanksDto } from './dto/approve-green-thanks.dto';
import { QueryGreenThanksDto } from './dto/query-green-thanks.dto';
import { GreenThanksResponseDto } from './dto/green-thanks-response.dto';

@ApiTags('Green Thanks')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller('green-thanks')
export class GreenThanksController {
  constructor(private readonly greenThanksService: GreenThanksService) {}

  @Post()
  @RequirePermissions('profile:read')
  @ApiOperation({ summary: 'Send Green Thanks points to another employee' })
  @ApiSuccessResponse(GreenThanksResponseDto, 'Green Thanks sent', 201)
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Body() dto: CreateGreenThanksDto,
  ) {
    return this.greenThanksService.create(organizationId, currentUser, dto);
  }

  @Get()
  @RequirePermissions('profile:read')
  @ApiOperation({
    summary: 'List Green Thanks entries (paginated)',
    description:
      'Ordinary employees see only rows where they are sender or receiver; privileged viewers ' +
      '(leave:approve/employee:read/*) see all org rows, optionally filtered by ' +
      '?direction=sent|received&status=pending|approved|rejected&employeeId=.',
  })
  @ApiPaginatedResponse(GreenThanksResponseDto, 'Paginated list of Green Thanks entries')
  findAll(
    @OrganizationId() organizationId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Query() query: QueryGreenThanksDto,
  ) {
    return this.greenThanksService.findAll(organizationId, currentUser, query);
  }

  @Put(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('leave:approve')
  @ApiOperation({ summary: 'Approve or reject a pending Green Thanks entry' })
  @ApiParam({ name: 'id', description: 'GreenThanks UUID' })
  @ApiSuccessResponse(GreenThanksResponseDto, 'Green Thanks entry approved or rejected')
  approve(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser() currentUser: RequestingUser,
    @Param('id') id: string,
    @Body() dto: ApproveGreenThanksDto,
  ) {
    return this.greenThanksService.approve(organizationId, userId, currentUser, id, dto);
  }
}
