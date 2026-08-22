import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LeaveType, LeavePolicyTypeItemDto } from './leave-policy-type-item.dto';

export { LeaveType };

export class CreateLeavePolicyDto {
  @ApiProperty({ example: 'Standard Policy' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    type: [LeavePolicyTypeItemDto],
    description: 'Leave types included in this policy bundle (e.g. CL + PL + SL)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeavePolicyTypeItemDto)
  types: LeavePolicyTypeItemDto[];
}
