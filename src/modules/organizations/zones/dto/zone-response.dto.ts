import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ZoneResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() name: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() deletedAt: Date | null;
}

export class ZoneDeleteResponseDto {
  @ApiProperty() deleted: boolean;
  @ApiProperty() message: string;
}
