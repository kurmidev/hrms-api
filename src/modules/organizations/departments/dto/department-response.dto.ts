import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepartmentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() parentId: string | null;
  @ApiPropertyOptional() headEmployeeId: string | null;
  @ApiProperty() hierarchyLevel: number;
  @ApiPropertyOptional() parent: { id: string; name: string } | null;
  @ApiProperty() employeeCount: number;
  @ApiProperty() childrenCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() deletedAt: Date | null;
}

export class DepartmentTreeNodeDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() parentId: string | null;
  @ApiPropertyOptional() headEmployeeId: string | null;
  @ApiProperty() hierarchyLevel: number;
  @ApiProperty() employeeCount: number;
  @ApiProperty({ type: () => [DepartmentTreeNodeDto] })
  children: DepartmentTreeNodeDto[];
}
