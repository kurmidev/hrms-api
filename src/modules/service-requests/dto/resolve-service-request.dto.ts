import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResolveServiceRequestDto {
  @ApiPropertyOptional({ description: 'Resolution note recorded as a comment' })
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
