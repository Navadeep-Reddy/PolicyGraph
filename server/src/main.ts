import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Local development only: the Vite client runs on a different port.
  app.enableCors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' });
  // Reject invalid request DTOs (e.g. empty clause text, unknown review
  // status) before they reach domain logic.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
