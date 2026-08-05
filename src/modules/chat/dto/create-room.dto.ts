import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatRoomType } from '@prisma/client';
import { ArrayNotEmpty, IsArray, IsEnum, IsString, IsUUID, ValidateIf } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ enum: ChatRoomType })
  @IsEnum(ChatRoomType)
  type: ChatRoomType;

  @ApiPropertyOptional({ description: 'Required for GROUP rooms' })
  @ValidateIf((dto: CreateRoomDto) => dto.type === ChatRoomType.GROUP)
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Required for DEPARTMENT rooms' })
  @ValidateIf((dto: CreateRoomDto) => dto.type === ChatRoomType.DEPARTMENT)
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Other participant employee IDs (the creator is auto-added). Exactly 1 for DIRECT, ' +
      'ignored for DEPARTMENT (auto-enrolled), 1+ for GROUP.',
  })
  @ValidateIf((dto: CreateRoomDto) => dto.type !== ChatRoomType.DEPARTMENT)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  memberEmployeeIds?: string[];
}
