import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyCode } from '../../../common/enums/currency.enum';

export class OrganizationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional() logoUrl: string | null;
  @ApiPropertyOptional() address: string | null;
  @ApiPropertyOptional() phone: string | null;
  @ApiPropertyOptional() email: string | null;
  @ApiPropertyOptional() website: string | null;
  @ApiProperty({ enum: CurrencyCode, default: CurrencyCode.INR }) currency: CurrencyCode;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
