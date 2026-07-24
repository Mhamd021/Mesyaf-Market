import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppLogger } from './common/logger/app-logger.service';
import { randomUUID } from 'crypto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = app.get(AppLogger);

  app.use((req: any, res: any, next: any) => {
    const requestId =
      typeof req.headers['x-request-id'] === 'string' &&
      req.headers['x-request-id'].length > 0
        ? req.headers['x-request-id']
        : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const startedAt = Date.now();
    res.on('finish', () => {
      logger.log('HttpRequest', {
        requestId,
        method: req.method,
        path: req.originalUrl ?? req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        ip: req.ip ?? null,
        userId: req.user?.id ?? null,
      });
    });

    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  process.on('unhandledRejection', (reason) => {
    logger.error('UnhandledRejection', { reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('UncaughtException', { error: err.message, stack: err.stack });
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
