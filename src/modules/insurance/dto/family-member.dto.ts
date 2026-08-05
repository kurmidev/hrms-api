import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MaxLength } from 'class-validator';

export class FamilyMemberDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MaxLength(191)
  name: string;

  @ApiProperty({ example: 'Spouse' })
  @IsString()
  @MaxLength(100)
  relation: string;

  @ApiProperty({ example: '1990-05-12' })
  @IsDateString()
  dateOfBirth: string;
}
