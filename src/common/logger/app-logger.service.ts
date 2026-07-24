import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class AppLogger  implements LoggerService {

   private context = 'App';

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, meta?: Record<string, any>) {
    this.print('info', message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.print('error', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.print('warn', message, meta);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.print('debug', message, meta);
  }

  private sanitize(value: unknown): unknown {
    if (value == null) return value;

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (typeof value !== 'object') {
      return value;
    }

    const redactedKeys = new Set([
      'password',
      'token',
      'access_token',
      'authorization',
      'refreshToken',
      'refresh_token',
      'secret',
      'jwt',
    ]);

    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, raw] of Object.entries(source)) {
      if (redactedKeys.has(key)) {
        output[key] = '[REDACTED]';
        continue;
      }
      output[key] = this.sanitize(raw);
    }

    return output;
  }

  private print(level: string, message: string, meta?: Record<string, any>) {
    const logObject = {
      level,
      context: this.context,
      message,
      ...(meta ? (this.sanitize(meta) as Record<string, unknown>) : {}),
      pid: process.pid,
      env: process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(logObject));
  }
}

