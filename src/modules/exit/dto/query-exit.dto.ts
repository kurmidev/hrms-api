import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExitStatus, ExitType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QueryExitDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by employee UUID' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ enum: ExitType })
  @IsOptional()
  @IsEnum(ExitType)
  type?: ExitType;

  @ApiPropertyOptional({ enum: ExitStatus })
  @IsOptional()
  @IsEnum(ExitStatus)
  status?: ExitStatus;
}
