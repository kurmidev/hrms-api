import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

// Models that track who created a record
const MODELS_WITH_CREATED_BY = new Set([
  'Organization', 'Role', 'Department', 'Designation', 'PayrollStructure',
  'Employee', 'LeavePolicy', 'LeaveApplication', 'TaxRule', 'Holiday',
  'AttendanceLog', 'PayrollRun', 'PayrollEntry', 'LoanApplication',
  'IncentiveRule', 'TodoTask', 'IncentiveLedger', 'GreenThanks',
  'GreenThanksConfig', 'ChatRoom', 'OnboardingLink', 'ServiceRequest',
  'ServiceRequestComment', 'Asset', 'AssetAssignment', 'DisciplinaryMemo',
  'ExitRecord', 'InsurancePolicy', 'EmployeeInsurance', 'Reminder',
  'PerformanceCycle', 'Notice',
]);

// Subset of above that also track who last updated a record
const MODELS_WITH_UPDATED_BY = new Set([
  'Organization', 'Role', 'Department', 'Designation', 'PayrollStructure',
  'Employee', 'LeavePolicy', 'AttendanceLog', 'PayrollRun', 'PayrollEntry',
  'LoanApplication', 'IncentiveRule', 'TodoTask', 'Notice', 'ServiceRequest',
  'Asset',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly cls: ClsService) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });

    // Auto-inject createdById / updatedById from the active CLS context on every write
    (this as any).$use(async (params: any, next: any) => {
      const userId = this.cls?.get?.('userId') as string | undefined;

      if (userId && params.model) {
        if (params.action === 'create' && MODELS_WITH_CREATED_BY.has(params.model)) {
          params.args.data = { ...params.args.data, createdById: userId };
        }

        if (
          (params.action === 'update' || params.action === 'updateMany') &&
          MODELS_WITH_UPDATED_BY.has(params.model)
        ) {
          params.args.data = { ...params.args.data, updatedById: userId };
        }

        if (params.action === 'upsert') {
          if (MODELS_WITH_CREATED_BY.has(params.model) && params.args.create) {
            params.args.create = { ...params.args.create, createdById: userId };
          }
          if (MODELS_WITH_UPDATED_BY.has(params.model) && params.args.update) {
            params.args.update = { ...params.args.update, updatedById: userId };
          }
        }
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase() is not allowed in production');
    }
    const tableNames = await this.$queryRaw<{ TABLE_NAME: string }[]>`
      SELECT TABLE_NAME FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND TABLE_NAME != '_prisma_migrations'
    `;
    for (const { TABLE_NAME } of tableNames) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``);
    }
  }
}
