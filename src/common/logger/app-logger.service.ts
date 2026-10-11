import { Inject, Injectable, LoggerService, Optional, Scope } from '@nestjs/common';
import { INQUIRER } from '@nestjs/core';

const REDACTED_KEYS = new Set([
  'password', 'token', 'access_token', 'authorization',
  'refreshToken', 'refresh_token', 'secret', 'jwt',
]);

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private context: string;

  constructor(@Optional() @Inject(INQUIRER) parent?: object) {
    this.context = parent?.constructor?.name ?? 'App';
  }

  setContext(context: string) {
    this.context = context; 
  }

  log(message: any, ...params: any[]) { this.print('info', message, params); }
  error(message: any, ...params: any[]) { this.print('error', message, params); }
  warn(message: any, ...params: any[]) { this.print('warn', message, params); }
  debug(message: any, ...params: any[]) { this.print('debug', message, params); }
  verbose(message: any, ...params: any[]) { this.print('debug', message, params); }

  private sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
    if (value == null || typeof value !== 'object') return value;

    if (value instanceof Error) {
      const e = value as Error & { code?: string };
      return {
        name: e.name,
        message: e.message,
        ...(e.code ? { code: e.code } : {}),
        stack: e.stack,
      };
    }

    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (Array.isArray(value)) return value.map((v) => this.sanitize(v, seen));

    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(key) ? '[REDACTED]' : this.sanitize(raw, seen);
    }
    return out;
  }

  private print(level: string, message: any, params: any[]) {
    let context = this.context;
    let meta: Record<string, unknown> = {};

    const strings = params.filter((p) => typeof p === 'string') as string[];
    if (strings.length) {
      context = strings[strings.length - 1];
      if (strings.length > 1) meta.stack = strings[0];
    }
    for (const p of params) {
      if (p instanceof Error) meta.error = p;
      else if (p && typeof p === 'object') meta = { ...meta, ...p };
    }

    const entry = {
      level,
      context,
      message: typeof message === 'string' ? message : this.sanitize(message),
      ...(this.sanitize(meta) as Record<string, unknown>),
      pid: process.pid,
      env: process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(entry));
  }
}