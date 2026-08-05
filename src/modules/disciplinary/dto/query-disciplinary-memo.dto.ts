import { ApiPropertyOptional } from '@nestjs/swagger';
import { DisciplinaryActionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QueryDisciplinaryMemoDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by employee UUID' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ enum: DisciplinaryActionType })
  @IsOptional()
  @IsEnum(DisciplinaryActionType)
  type?: DisciplinaryActionType;

  @ApiPropertyOptional({ description: 'Filter by status (active | withdrawn | acknowledged)' })
  @IsOptional()
  @IsString()
  status?: string;
}
