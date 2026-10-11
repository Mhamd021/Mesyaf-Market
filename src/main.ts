import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppLogger } from './common/logger/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  const logger = await app.resolve(AppLogger);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  const httpLogger = await app.resolve(AppLogger);
  httpLogger.setContext('Http');

  const filterLogger = await app.resolve(AppLogger);
  filterLogger.setContext('GlobalExceptionFilter');

  app.set('trust proxy', 1);
  app.enableShutdownHooks(); 

  app.use((req: any, res: any, next: any) => {
    const requestId =
      typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].length > 0
        ? req.headers['x-request-id']
        : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const startedAt = Date.now();
    res.on('finish', () => {
      httpLogger.log('HttpRequest', {
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

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new GlobalExceptionFilter(filterLogger));

  process.on('unhandledRejection', (reason) => {
    logger.error('UnhandledRejection', { reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('UncaughtException', { error });
    process.exit(1);
  });

  await app.listen(process.env.PORT ?? 3000);
  logger.log('ServerStarted', { port: process.env.PORT ?? 3000 });
}
bootstrap();