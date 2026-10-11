import { Injectable, Scope } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logger/app-logger.service';

type Loc = { lat: number; lng: number; timestamp: Date };

@Injectable()
export class DelivererLocationService {
  private readonly TTL_SECONDS = 30;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  private key(id: number | string) {
    return `location:deliverer:${id}`;
  }

  isValid(lat: unknown, lng: unknown): boolean {
    return (
      typeof lat === 'number' && typeof lng === 'number' &&
      Number.isFinite(lat) && Number.isFinite(lng) &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    );
  }

  async update(delivererId: number, lat: number, lng: number) {
    await this.redis.set(this.key(delivererId), { lat, lng, timestamp: new Date() }, this.TTL_SECONDS);
  }

  async get(delivererId: number): Promise<{ lat: number; lng: number; source: 'redis' | 'db' } | null> {
    const cached = await this.redis.get<Loc>(this.key(delivererId));
    if (cached) return { lat: cached.lat, lng: cached.lng, source: 'redis' };

    const p = await this.prisma.delivererProfile.findUnique({
      where: { id: delivererId },
      select: { currentLat: true, currentLng: true },
    });
    return p?.currentLat != null && p?.currentLng != null
      ? { lat: p.currentLat, lng: p.currentLng, source: 'db' }
      : null;
  }

  async getMany(ids: number[]): Promise<Map<number, { lat: number; lng: number }>> {
    const result = new Map<number, { lat: number; lng: number }>();
    const missing: number[] = [];

    for (const id of ids) {
      const cached = await this.redis.get<Loc>(this.key(id));
      if (cached) result.set(id, { lat: cached.lat, lng: cached.lng });
      else missing.push(id);
    }

    if (missing.length) {
      const rows = await this.prisma.delivererProfile.findMany({
        where: { id: { in: missing } },
        select: { id: true, currentLat: true, currentLng: true },
      });
      for (const r of rows) {
        if (r.currentLat != null && r.currentLng != null) {
          result.set(r.id, { lat: r.currentLat, lng: r.currentLng });
        }
      }
    }
    return result;
  }

  async flushToDb(delivererId: number) {
    const loc = await this.redis.get<Loc>(this.key(delivererId));
    if (!loc) return;
    await this.prisma.delivererProfile.update({
      where: { id: delivererId },
      data: { currentLat: loc.lat, currentLng: loc.lng },
    });
  }

  @Cron('*/5 * * * *')
  async flushAll() {
    const keys = await this.redis.getKeysByPattern('location:deliverer:*');
    for (const k of keys) {
      try {
        await this.flushToDb(Number(k.split(':')[2]));
      } catch (error) {
        this.logger.error('LocationFlushFailed', { key: k, error });
      }
    }
  }
}