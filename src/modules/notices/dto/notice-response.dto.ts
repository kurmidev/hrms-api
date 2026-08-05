import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NoticeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ enum: ['draft', 'scheduled', 'published'] })
  status: string;

  @ApiProperty({ enum: ['ALL', 'TARGETED'] })
  targetType: string;

  @ApiPropertyOptional({ type: [String] })
  targetRoles: string[] | null;

  @ApiPropertyOptional({ type: [String] })
  targetDepts: string[] | null;

  @ApiPropertyOptional()
  scheduledAt: Date | null;

  @ApiPropertyOptional()
  publishedAt: Date | null;

  @ApiPropertyOptional()
  expiresAt: Date | null;

  @ApiPropertyOptional()
  attachmentUrl: string | null;

  @ApiPropertyOptional()
  attachmentName: string | null;

  @ApiPropertyOptional({ description: 'Present on board view only' })
  hasRead?: boolean;

  @ApiPropertyOptional({ description: 'Present on manage view only' })
  readCount?: number;

  @ApiProperty()
  createdAt: Date;
}

export class NoticeDeleteResponseDto {
  @ApiProperty({ description: 'ID of the deleted notice' })
  id: string;
}

export class NoticeMarkReadResponseDto {
  @ApiProperty({ description: 'Notice UUID' })
  id: string;

  @ApiProperty({ description: 'Always true — marking as read is idempotent' })
  hasRead: boolean;
}
