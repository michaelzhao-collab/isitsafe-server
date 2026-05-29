import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor(private config: ConfigService) {
    const url = this.config.get('REDIS_URL');
    if (url) {
      this.client = new Redis(url);
    } else {
      const host = this.config.get('REDIS_HOST', 'localhost');
      const port = parseInt(this.config.get('REDIS_PORT', '6379'), 10);
      const password = this.config.get('REDIS_PASSWORD') || undefined;
      this.client = new Redis(port, host, { password });
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * 原子获取锁。基于 ioredis 的 SET key value EX ttl NX。
   * 成功返回 true（锁是你的）；失败返回 false（已有人持锁）。
   *
   * 典型用法：
   *   const ok = await redis.acquireLock(`family_broadcast:${groupId}:${hash}:${ymd}`, 60);
   *   if (!ok) return { skipReason: 'duplicate' };
   *   try { ... } finally { await redis.releaseLock(key); }
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
