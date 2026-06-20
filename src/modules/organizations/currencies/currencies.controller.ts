import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { CURRENCY_METADATA, CurrencyCode } from '../../../common/enums/currency.enum';
import { CurrencyResponseDto } from './dto/currency-response.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('currencies')
export class CurrenciesController {
  @Get()
  @RequirePermissions('org:read')
  @ApiOperation({
    summary: 'List all supported currencies',
    description: 'Returns all ISO 4217 currency codes with their names and symbols.',
  })
  @ApiResponse({ status: 200, description: 'List of currencies', type: [CurrencyResponseDto] })
  findAll(): CurrencyResponseDto[] {
    return (Object.keys(CURRENCY_METADATA) as CurrencyCode[]).map((code) => ({
      code,
      name: CURRENCY_METADATA[code].name,
      symbol: CURRENCY_METADATA[code].symbol,
    }));
  }
}
