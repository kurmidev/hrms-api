import { ApiPropertyOptional } from '@nestjs/swagger';
import { InsuranceType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QueryInsurancePolicyDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InsuranceType })
  @IsOptional()
  @IsEnum(InsuranceType)
  type?: InsuranceType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
