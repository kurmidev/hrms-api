import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class MarkPaidDto {
  @IsDateString()
  paymentDate: string;

  @IsString()
  paymentMethod: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNumber()
  amount: number;

  @IsString()
  recordedById: string;
}
