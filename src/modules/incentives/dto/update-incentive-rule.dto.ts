import { PartialType } from '@nestjs/swagger';
import { CreateIncentiveRuleDto } from './create-incentive-rule.dto';

export class UpdateIncentiveRuleDto extends PartialType(CreateIncentiveRuleDto) {}
