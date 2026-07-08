import { IsString, IsEmail, IsOptional, IsNumber, IsEnum, Matches } from 'class-validator';

export enum BillingCycleEnum {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export class RegisterOrganizationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
  phone?: string;

  @IsString()
  planId: string;

  @IsEnum(BillingCycleEnum)
  billingCycle: BillingCycleEnum;

  @IsOptional()
  @IsNumber()
  gracePeriodDays?: number;

  @IsEmail()
  adminEmail: string;

  @IsOptional()
  @IsString()
  adminName?: string;

  @IsOptional()
  @IsNumber()
  taxPercent?: number;

  @IsOptional()
  @IsNumber()
  dueAfterDays?: number;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
  phone?: string;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsEnum(BillingCycleEnum)
  billingCycle?: BillingCycleEnum;
}
