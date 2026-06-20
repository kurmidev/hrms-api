import { ApiProperty } from '@nestjs/swagger';
import { CurrencyCode } from '../../../../common/enums/currency.enum';

export class CurrencyResponseDto {
  @ApiProperty({ enum: CurrencyCode, example: CurrencyCode.INR })
  code: CurrencyCode;

  @ApiProperty({ example: 'Indian Rupee' })
  name: string;

  @ApiProperty({ example: '₹' })
  symbol: string;
}
