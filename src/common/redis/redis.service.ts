// src/common/redis/redis.service.ts
import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.set(key, serialized, 'EX', ttl);
    } else {
      await this.redis.set(key, serialized);
    }
  }

 
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }

 
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }


  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async getKeysByPattern(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        200,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }

  async incrWithExpire(key: string, ttlSeconds: number): Promise<number> {
  const hits = await this.redis.incr(key);
  if (hits === 1) {
    await this.redis.expire(key, ttlSeconds);
  }
  return hits;
}
async getTtl(key: string): Promise<number> {
  return this.redis.ttl(key);
}

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
