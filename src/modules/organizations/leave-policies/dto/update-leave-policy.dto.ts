import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateLeavePolicyDto } from './create-leave-policy.dto';

export class UpdateLeavePolicyDto extends PartialType(CreateLeavePolicyDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
