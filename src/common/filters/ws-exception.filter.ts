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

  private normalizeCode(message: unknown): string {
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.toUpperCase().replace(/\s+/g, '_');
    }
    return 'WS_INTERNAL_ERROR';
  }

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

    const code = this.normalizeCode(message);

    this.logger.error('WebSocketException', {
      socketId: client?.id ?? null,
      userId: client?.data?.userId ?? client?.data?.customerId ?? null,
      code,
      error: (exception as any)?.message,
      stack: (exception as any)?.stack,
      eventData: data,
    });

    client.emit('error', {
      code,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
