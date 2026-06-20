import { PartialType } from '@nestjs/swagger';
import { CreatePayrollStructureDto } from './create-payroll-structure.dto';

export class UpdatePayrollStructureDto extends PartialType(CreatePayrollStructureDto) {}
