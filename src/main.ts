import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');
  const apiPrefix = configService.get<string>('apiPrefix');
  const nodeEnv = configService.get<string>('nodeEnv');

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: nodeEnv === 'production' ? configService.get('appUrl') : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // Swagger (only in non-production)
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('IGreen HRMS API')
      .setDescription('Enterprise Human Resource Management System API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Auth', 'Authentication & Authorization')
      .addTag('Organizations', 'Organization Management')
      .addTag('Employees', 'Employee Management')
      .addTag('Attendance', 'Attendance & Tracking')
      .addTag('Leave', 'Leave Management')
      .addTag('Payroll', 'Payroll Processing')
      .addTag('Loans', 'Loan Management')
      .addTag('Incentives', 'Todo & Incentive Engine')
      .addTag('Green Thanks', 'Recognition & Reward')
      .addTag('Chat', 'Internal Communication')
      .addTag('Notices', 'Announcements & Notices')
      .addTag('Performance', 'Performance Ratings')
      .addTag('Service Requests', 'Feedback & Service Requests')
      .addTag('Assets', 'Asset Management')
      .addTag('Disciplinary', 'Disciplinary Management')
      .addTag('Exit', 'Exit Management')
      .addTag('Reports', 'Reporting & BI')
      .addTag('Dashboard', 'Dashboard Aggregates')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    console.log(`📖 Swagger docs: http://localhost:${port}/docs`);
  }

  await app.listen(port);
  console.log(`🚀 HRMS API running on: http://localhost:${port}/${apiPrefix}`);
}

bootstrap();
