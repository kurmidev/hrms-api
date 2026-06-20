import { PartialType } from '@nestjs/swagger';
import { CreateLeaveRuleDto } from './create-leave-rule.dto';

export class UpdateLeaveRuleDto extends PartialType(CreateLeaveRuleDto) {}
