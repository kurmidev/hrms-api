import { PartialType } from '@nestjs/swagger';
import { CreateLeavePolicyDto } from './create-leave-policy.dto';

export class UpdateLeavePolicyDto extends PartialType(CreateLeavePolicyDto) {}
