import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const CACHE_PREFIX = 'query:';
const CACHE_TTL = 3600; // 1 hour

@Injectable()
export class QueryService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private cacheKey(type: string, content: string): string {
    return `${CACHE_PREFIX}${type}:${content}`;
  }

  async queryPhone(phone: string, userId?: string) {
    const cached = await this.redis.get(this.cacheKey('phone', phone));
    if (cached) return JSON.parse(cached);

    const items = await this.prisma.riskData.findMany({
      where: { type: 'phone', content: { contains: phone, mode: 'insensitive' } },
      take: 20,
    });
    const result = {
      risk_level: items.length ? (items[0].riskLevel as 'high' | 'medium' | 'low') : 'low',
      tags: items.flatMap((i) => (Array.isArray(i.tags) ? i.tags : [])),
      records: items,
    };
    await this.redis.set(this.cacheKey('phone', phone), JSON.stringify(result), CACHE_TTL);
    return result;
  }

  async queryUrl(url: string, userId?: string) {
    console.log('[QUERY_URL] 输入 content=' + JSON.stringify(url?.slice(0, 200)) + ' （本接口仅查风险库，不调用豆包）');
    const cached = await this.redis.get(this.cacheKey('url', url));
    if (cached) {
      const result = JSON.parse(cached);
      console.log('[QUERY_URL] 命中缓存 risk_level=' + result.risk_level + ' recordsCount=' + (result.records?.length ?? 0));
      return result;
    }

    const items = await this.prisma.riskData.findMany({
      where: { type: 'url', content: { contains: url, mode: 'insensitive' } },
      take: 20,
    });
    const result = {
      risk_level: items.length ? (items[0].riskLevel as 'high' | 'medium' | 'low') : 'low',
      tags: items.flatMap((i) => (Array.isArray(i.tags) ? i.tags : [])),
      records: items,
    };
    console.log('[QUERY_URL] 风险库查询 命中条数=' + items.length + ' risk_level=' + result.risk_level + ' 结论原因: ' + (items.length ? '库中存在该URL/域名相关风险记录' : '库中无匹配记录，故判为低风险'));
    await this.redis.set(this.cacheKey('url', url), JSON.stringify(result), CACHE_TTL);
    return result;
  }

  async queryCompany(name: string, userId?: string) {
    const cached = await this.redis.get(this.cacheKey('company', name));
    if (cached) return JSON.parse(cached);

    const items = await this.prisma.riskData.findMany({
      where: { type: 'company', content: { contains: name, mode: 'insensitive' } },
      take: 20,
    });
    const result = {
      risk_level: items.length ? (items[0].riskLevel as 'high' | 'medium' | 'low') : 'low',
      tags: items.flatMap((i) => (Array.isArray(i.tags) ? i.tags : [])),
      records: items,
    };
    await this.redis.set(this.cacheKey('company', name), JSON.stringify(result), CACHE_TTL);
    return result;
  }

  async queryBatch(requests: { type: 'phone' | 'url' | 'company'; content: string }[]) {
    const results = await Promise.all(
      requests.map(async (r) => {
        if (r.type === 'phone') return this.queryPhone(r.content);
        if (r.type === 'url') return this.queryUrl(r.content);
        return this.queryCompany(r.content);
      }),
    );
    return results;
  }

  async getTags() {
    const cached = await this.redis.get(CACHE_PREFIX + 'tags');
    if (cached) return JSON.parse(cached);
    const data = await this.prisma.riskData.findMany({ select: { tags: true } });
    const set = new Set<string>();
    data.forEach((d) => {
      const arr = Array.isArray(d.tags) ? d.tags : [];
      arr.forEach((t: string) => set.add(t));
    });
    const tags = Array.from(set);
    await this.redis.set(CACHE_PREFIX + 'tags', JSON.stringify(tags), CACHE_TTL * 24);
    return tags;
  }
}
