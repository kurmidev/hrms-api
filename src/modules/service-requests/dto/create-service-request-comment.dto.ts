import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateServiceRequestCommentDto {
  @ApiProperty({ example: 'Escalated to IT lead.' })
  @IsString()
  @MinLength(1)
  content: string;
}
