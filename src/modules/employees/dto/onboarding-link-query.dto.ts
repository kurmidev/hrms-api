import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { OnboardingStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class OnboardingLinkQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OnboardingStatus })
  @IsEnum(OnboardingStatus)
  @IsOptional()
  status?: OnboardingStatus;
}
