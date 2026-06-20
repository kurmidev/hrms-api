import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MoveDepartmentDto {
  @ApiPropertyOptional({
    description: 'New parent department ID. Set to null to promote to root level.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  newParentId?: string | null;
}
