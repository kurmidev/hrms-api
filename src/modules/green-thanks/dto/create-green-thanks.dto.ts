import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Min } from 'class-validator';

export class CreateGreenThanksDto {
  @ApiProperty({ description: 'Recipient employee UUID' })
  @IsUUID()
  toEmployeeId: string;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  points: number;

  @ApiProperty({ example: 'Helped me finish the quarterly report on time' })
  @IsString()
  reason: string;
}
