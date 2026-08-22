import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from '@prisma/client';

export class ServiceRequestEmployeeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  empCode: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;
}

export class ServiceRequestCommentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  serviceRequestId: string;

  @ApiPropertyOptional({ nullable: true })
  authorId: string | null;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;
}

export class ServiceRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiPropertyOptional({ nullable: true, description: 'null when the request is anonymous' })
  employeeId: string | null;

  @ApiPropertyOptional({
    type: ServiceRequestEmployeeDto,
    nullable: true,
    description: 'Nulled for non-managers when isAnonymous is true',
  })
  employee?: ServiceRequestEmployeeDto | null;

  @ApiProperty({ enum: ServiceRequestCategory })
  category: ServiceRequestCategory;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: ServiceRequestPriority })
  priority: ServiceRequestPriority;

  @ApiProperty({ enum: ServiceRequestStatus })
  status: ServiceRequestStatus;

  @ApiPropertyOptional({ nullable: true })
  assignedTo: string | null;

  @ApiPropertyOptional({ nullable: true })
  slaDeadline: Date | null;

  @ApiProperty()
  isAnonymous: boolean;

  @ApiPropertyOptional({ nullable: true })
  resolvedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  closedAt: Date | null;

  @ApiPropertyOptional({ nullable: true, description: 'Set only when category=SPECIAL_LEAVE' })
  leavePolicyTypeId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Set only when category=SPECIAL_LEAVE' })
  leaveFromDate?: Date | null;

  @ApiPropertyOptional({ nullable: true, description: 'Set only when category=SPECIAL_LEAVE' })
  leaveToDate?: Date | null;

  @ApiPropertyOptional({ nullable: true, description: 'Set only when category=SPECIAL_LEAVE' })
  leaveDays?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Set once the request is granted via /grant-special-leave',
  })
  leaveApplicationId?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    type: [ServiceRequestCommentResponseDto],
    description: 'Present on the detail (findOne) response only',
  })
  comments?: ServiceRequestCommentResponseDto[];
}
