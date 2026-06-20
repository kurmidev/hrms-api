import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class LeavePolicyQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LeaveType })
  @IsEnum(LeaveType)
  @IsOptional()
  leaveType?: LeaveType;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}
