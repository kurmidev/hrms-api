import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalaryComponentDto } from './salary-component.dto';

export class DesignationSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() departmentName: string;
  @ApiProperty() level: number;
}

export class PayrollStructureResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: [SalaryComponentDto] }) components: SalaryComponentDto[];
  @ApiProperty() isActive: boolean;
  @ApiProperty() employeeCount: number;
  @ApiProperty() designationCount: number;
  @ApiPropertyOptional({ type: [DesignationSummaryDto] }) designations?: DesignationSummaryDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() deletedAt: Date | null;
}
