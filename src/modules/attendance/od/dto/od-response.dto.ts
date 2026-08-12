import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OdLocationEntryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() odRecordId: string;
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiPropertyOptional() locationName: string | null;
  @ApiProperty() minutes: number;
  @ApiProperty() recordedAt: Date;
}

export class OdResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() employeeId: string;
  @ApiProperty() date: Date;
  @ApiPropertyOptional() reason: string | null;
  @ApiProperty() totalMinutes: number;
  @ApiProperty({ type: () => [OdLocationEntryResponseDto] })
  entries: OdLocationEntryResponseDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
