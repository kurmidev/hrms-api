import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { RolesModule } from './modules/roles/roles.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FilesModule } from './modules/files/files.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/roles.guard';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  imports: [
    // CLS (Continuation-Local Storage) — provides per-request async context for audit fields
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),

    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl') * 1000,
          limit: config.get<number>('throttle.limit'),
        },
      ],
    }),

    // Cron scheduler
    ScheduleModule.forRoot(),

    // BullMQ (background jobs)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
        },
      }),
    }),

    // Core infrastructure modules
    PrismaModule,
    RedisModule,

    // Feature modules
    AuthModule,
    RolesModule,

    // Feature modules (M05+)
    OrganizationsModule,
    NotificationsModule,
    FilesModule,
    EmployeesModule,
    // Modules to be added as they are developed
    // AttendanceModule,
    // LeaveModule,
    // PayrollModule,
    // LoansModule,
    // IncentivesModule,
    // GreenThanksModule,
    // ChatModule,
    // NoticesModule,
    // PerformanceModule,
    // ServiceRequestsModule,
    // AssetsModule,
    // DisciplinaryModule,
    // ExitModule,
    // InsuranceModule,
    // RemindersModule,
    // ReportsModule,
    // DashboardModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}
