import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiPropertyOptional({ example: 'Hey, are you free for a quick call?' })
  @IsOptional()
  @IsString()
  content?: string;
}
