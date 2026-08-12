import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkLocationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() name: string;
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiProperty() radiusMeters: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() deletedAt: Date | null;
}

export class WorkLocationDeleteResponseDto {
  @ApiProperty() deleted: boolean;
  @ApiProperty() message: string;
}
