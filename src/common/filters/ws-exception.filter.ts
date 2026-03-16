import {
  Catch,
  ArgumentsHost,
  WsExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AppLogger } from '../logger/app-logger.service';

@Catch()
export class GlobalWsExceptionFilter implements WsExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToWs();
    const client = ctx.getClient();
    const data = ctx.getData();

    let message = 'Internal server error';

    if (exception instanceof WsException) {
      message = exception.getError() as string;
    }

    if (exception instanceof HttpException) {
      message = exception.message;
    }

    this.logger.error('WebSocketException', {
      error: (exception as any)?.message,
      stack: (exception as any)?.stack,
      eventData: data,
    });

    client.emit('error', {
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
