import { ApiProperty } from '@nestjs/swagger';

export class HeadcountByDepartmentDto {
  @ApiProperty()
  departmentId: string;

  @ApiProperty()
  departmentName: string;

  @ApiProperty()
  count: number;
}

export class HeadcountByDesignationDto {
  @ApiProperty()
  designationId: string;

  @ApiProperty()
  designationName: string;

  @ApiProperty()
  count: number;
}

export class HeadcountByEmploymentTypeDto {
  @ApiProperty()
  employmentType: string;

  @ApiProperty()
  count: number;
}

export class HeadcountByStatusDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  count: number;
}

export class HeadcountReportDto {
  @ApiProperty({ description: 'Total non-deleted employees in the organization (post-filter)' })
  total: number;

  @ApiProperty({ type: [HeadcountByDepartmentDto] })
  byDepartment: HeadcountByDepartmentDto[];

  @ApiProperty({ type: [HeadcountByDesignationDto] })
  byDesignation: HeadcountByDesignationDto[];

  @ApiProperty({ type: [HeadcountByEmploymentTypeDto] })
  byEmploymentType: HeadcountByEmploymentTypeDto[];

  @ApiProperty({ type: [HeadcountByStatusDto] })
  byStatus: HeadcountByStatusDto[];
}
