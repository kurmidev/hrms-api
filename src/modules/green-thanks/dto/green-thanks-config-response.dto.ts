import { ApiProperty } from '@nestjs/swagger';

export class GreenThanksConfigResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  inrPerPoint: number;

  @ApiProperty()
  quarterlyLimitPoints: number;

  @ApiProperty()
  isPayrollLinked: boolean;

  @ApiProperty()
  effectiveFrom: Date;

  @ApiProperty()
  createdAt: Date;
}
