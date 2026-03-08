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

  async onModuleDestroy() {
    await this.client.quit();
  }
}
