import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { PlatformJwtAuthGuard } from '../platform-auth/platform-jwt-auth.guard';
import { InvoicesService } from './invoices.service';
import { MarkPaidDto } from './dto/mark-paid.dto';

@Public()
@ApiTags('Platform Invoices')
@ApiBearerAuth()
@UseGuards(PlatformJwtAuthGuard)
@Controller('platform')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Get('invoices')
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findAll(Number(page) || 1, Number(limit) || 20);
  }

  @Get('organizations/:orgId/invoices')
  findByOrg(
    @Param('orgId') orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findByOrg(orgId, Number(page) || 1, Number(limit) || 20);
  }

  @Post('organizations/:orgId/invoices')
  createManual(@Param('orgId') orgId: string) {
    // Placeholder for manual invoice creation
    return { message: 'Manual invoice creation not yet implemented' };
  }

  @Put('invoices/:id/mark-paid')
  markPaid(@Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.service.markPaid(id, dto);
  }

  @Put('invoices/:id/void')
  void(@Param('id') id: string) {
    return this.service.voidInvoice(id);
  }
}
