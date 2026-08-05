import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ServiceRequestCategory, ServiceRequestPriority } from '@prisma/client';

export class CreateServiceRequestDto {
  @ApiProperty({ enum: ServiceRequestCategory })
  @IsEnum(ServiceRequestCategory)
  category: ServiceRequestCategory;

  @ApiProperty({ example: 'Laptop not booting' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'My laptop stopped booting since yesterday morning.' })
  @IsString()
  @MinLength(3)
  description: string;

  @ApiPropertyOptional({
    enum: ServiceRequestPriority,
    default: ServiceRequestPriority.MEDIUM,
    description:
      'Ignored/escalated for COMPLIANCE category, which is always forced to at least HIGH',
  })
  @IsOptional()
  @IsEnum(ServiceRequestPriority)
  priority?: ServiceRequestPriority;

  @ApiPropertyOptional({
    default: false,
    description:
      'Raise anonymously (requester identity hidden from non-managers). Rejected with 400 if ' +
      'the organization has disabled allowAnonymousServiceRequests.',
  })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
