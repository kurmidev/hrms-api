import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';
import {
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from '@prisma/client';

export class QueryServiceRequestDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ServiceRequestStatus })
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

  @ApiPropertyOptional({ enum: ServiceRequestCategory })
  @IsOptional()
  @IsEnum(ServiceRequestCategory)
  category?: ServiceRequestCategory;

  @ApiPropertyOptional({ enum: ServiceRequestPriority })
  @IsOptional()
  @IsEnum(ServiceRequestPriority)
  priority?: ServiceRequestPriority;

  @ApiPropertyOptional({ description: 'Filter by assigned user UUID' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}
