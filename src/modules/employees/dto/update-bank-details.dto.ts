import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export enum BankAccountType {
  SAVINGS = 'SAVINGS',
  CURRENT = 'CURRENT',
}

export class UpdateBankDetailsDto {
  @ApiProperty({ example: 'HDFC Bank' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ example: '123456789012' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({ example: 'HDFC0001234', description: 'IFSC code (11 chars)' })
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'Invalid IFSC code format' })
  ifscCode: string;

  @ApiProperty({ enum: BankAccountType, example: BankAccountType.SAVINGS })
  @IsEnum(BankAccountType)
  accountType: BankAccountType;

  @ApiPropertyOptional({ example: 'Andheri West' })
  @IsOptional()
  @IsString()
  branchName?: string;

  @ApiPropertyOptional({ example: '400240001' })
  @IsOptional()
  @IsString()
  micrCode?: string;
}
