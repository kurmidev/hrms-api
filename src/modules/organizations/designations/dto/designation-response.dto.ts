import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DesignationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() departmentId: string;
  @ApiProperty() departmentName: string;
  @ApiProperty() name: string;
  @ApiProperty({ description: '1 = most senior, higher = more junior, 0 = unset' }) level: number;
  @ApiPropertyOptional() payrollStructureId: string | null;
  @ApiPropertyOptional() payrollStructureName: string | null;
  @ApiProperty() employeeCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() deletedAt: Date | null;
}
