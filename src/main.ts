import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppLogger } from './common/logger/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const logger = app.get(AppLogger);
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
