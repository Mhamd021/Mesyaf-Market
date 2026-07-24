import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '../logger/app-logger.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  private normalizeCode(status: number, payload: unknown): string {
    if (status >= 500) return 'INTERNAL_SERVER_ERROR';
    if (typeof payload === 'string') {
      return payload.toUpperCase().replace(/\s+/g, '_');
    }
    if (payload && typeof payload === 'object') {
      const body = payload as Record<string, unknown>;
      if (typeof body.error === 'string') {
        return body.error.toUpperCase().replace(/\s+/g, '_');
      }
    }
    return 'HTTP_ERROR';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    }

    const requestId =
      (request as any).requestId ??
      response.getHeader('x-request-id') ??
      null;
    const code = this.normalizeCode(status, message);

    if (status >= 500) {
      this.logger.error('UnhandledException', {
        requestId,
        path: request.url,
        method: request.method,
        status,
        code,
        userId: (request as any)?.user?.id ?? null,
        error: (exception as any)?.message,
        stack: (exception as any)?.stack,
      });
    } else {
      this.logger.warn('HttpException', {
        requestId,
        path: request.url,
        method: request.method,
        status,
        code,
        userId: (request as any)?.user?.id ?? null,
        message,
      });
    }

    response.status(status).json({
      requestId,
      statusCode: status,
      code,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
