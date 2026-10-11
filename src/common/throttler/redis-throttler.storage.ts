import { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import { RedisService } from "../redis/redis.service";
import { ThrottlerStorage } from "@nestjs/throttler";
import { Injectable } from "@nestjs/common";

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttler:${throttlerName}:${key}:hits`;
    const blockKey = `throttler:${throttlerName}:${key}:block`;

    const blocked = await this.redisService.exists(blockKey);
    if (blocked) {
      const blockedData = await this.redisService.get<{ expiresAt: number }>(blockKey);
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: blockedData
          ? Math.ceil((blockedData.expiresAt - Date.now()) / 1000)
          : Math.ceil(blockDuration / 1000),
      };
    }

    const ttlSeconds = Math.ceil(ttl / 1000);
    const hits = await this.redisService.incrWithExpire(hitsKey, ttlSeconds);
    const remainingTtl = await this.redisService.getTtl(hitsKey);
    const timeToExpire = remainingTtl > 0 ? remainingTtl : ttlSeconds;

    if (hits > limit && blockDuration > 0) {
      const blockExpiresAt = Date.now() + blockDuration;
      await this.redisService.set(
        blockKey,
        { expiresAt: blockExpiresAt },
        Math.ceil(blockDuration / 1000),
      );

      return {
        totalHits: hits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockDuration / 1000),
      };
    }

    return {
      totalHits: hits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}

//incrWithExpire replaces the get → branch → set sequence with Redis's native INCR, which is atomic server-side — no read-then-write gap for concurrent requests to race inside