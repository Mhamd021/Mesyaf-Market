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

  private print(level: string, message: string, meta?: Record<string, any>) {
    const logObject = {
      level,
      context: this.context,
      message,
      ...meta,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(logObject));
  }
}

