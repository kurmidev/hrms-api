import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum DocumentType {
  AADHAAR = 'AADHAAR',
  PAN = 'PAN',
  PASSPORT = 'PASSPORT',
  DRIVING_LICENCE = 'DRIVING_LICENCE',
  VOTER_ID = 'VOTER_ID',
  DEGREE = 'DEGREE',
  RESUME = 'RESUME',
  OFFER_LETTER = 'OFFER_LETTER',
  EXPERIENCE_LETTER = 'EXPERIENCE_LETTER',
  OTHER = 'OTHER',
}

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentType, example: DocumentType.AADHAAR })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiPropertyOptional({ example: 'Aadhaar card front and back' })
  @IsOptional()
  @IsString()
  notes?: string;
}
