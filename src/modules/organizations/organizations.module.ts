import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { DepartmentsController } from './departments/departments.controller';
import { DepartmentsService } from './departments/departments.service';
import { DesignationsController } from './designations/designations.controller';
import { DesignationsService } from './designations/designations.service';
import { TaxRulesController } from './tax-rules/tax-rules.controller';
import { TaxRulesService } from './tax-rules/tax-rules.service';
import { PayrollStructuresController } from './payroll-structures/payroll-structures.controller';
import { PayrollStructuresService } from './payroll-structures/payroll-structures.service';
import { CurrenciesController } from './currencies/currencies.controller';
import { LeavePoliciesController } from './leave-policies/leave-policies.controller';
import { LeavePoliciesService } from './leave-policies/leave-policies.service';

@Module({
  controllers: [
    OrganizationsController,
    CurrenciesController,
    DepartmentsController,
    DesignationsController,
    TaxRulesController,
    PayrollStructuresController,
    LeavePoliciesController,
  ],
  providers: [
    OrganizationsService,
    DepartmentsService,
    DesignationsService,
    TaxRulesService,
    PayrollStructuresService,
    LeavePoliciesService,
  ],
  exports: [
    DepartmentsService,
    DesignationsService,
    TaxRulesService,
    PayrollStructuresService,
    LeavePoliciesService,
  ],
})
export class OrganizationsModule {}
