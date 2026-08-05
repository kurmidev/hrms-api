import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { QueryReportDto } from './query-report.dto';

export const REPORT_EXPORT_FORMATS = ['excel', 'pdf'] as const;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

export class ExportReportDto extends QueryReportDto {
  @ApiPropertyOptional({
    description: 'Export file format',
    enum: REPORT_EXPORT_FORMATS,
    default: 'excel',
  })
  @IsOptional()
  @IsIn(REPORT_EXPORT_FORMATS)
  format?: ReportExportFormat = 'excel';
}
