import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export type GreenThanksDirection = 'sent' | 'received';
export type GreenThanksStatus = 'pending' | 'approved' | 'rejected';

export class QueryGreenThanksDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['sent', 'received'] })
  @IsOptional()
  @IsIn(['sent', 'received'])
  direction?: GreenThanksDirection;

  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected'] })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: GreenThanksStatus;

  @ApiPropertyOptional({ description: 'Filter by employee UUID (privileged viewers only)' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
