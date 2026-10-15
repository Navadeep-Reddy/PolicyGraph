import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ContractExceptionFilter } from './common/contract-exception.filter.js';

export function configureApp(app: INestApplication): void {
  app.enableCors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  app.useGlobalFilters(new ContractExceptionFilter(app.get(HttpAdapterHost)));
}
