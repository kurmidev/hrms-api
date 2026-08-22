import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { GlobalLeaveItemDto } from './global-leave-item.dto';

export class BulkCreateGlobalLeaveDto {
  @ApiProperty({ type: [GlobalLeaveItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GlobalLeaveItemDto)
  items: GlobalLeaveItemDto[];
}
