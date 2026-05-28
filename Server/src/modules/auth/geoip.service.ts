import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

/**
 * IP 地理位置解析服务
 *
 * 解析顺序：
 *  1. Cloudflare `cf-ipcountry` header（如果 Server 在 Cloudflare 代理后）— 准、快、免费
 *  2. ipapi.co 免费 API（1k/天，无需注册，含 country / city / region）
 *
 * 设计：
 *  - 不阻塞主流程：用 fire-and-forget，登录响应不等 lookup
 *  - 仅当 user.country 为空时才查（避免覆盖用户已设置的国家）
 *  - 私网 / 本地 IP 跳过（127.* / 10.* / 192.168.* / ::1）
 *  - 内存缓存 5min，避免短时间重复请求同一 IP
 */
@Injectable()
export class GeoIpService {
  private readonly logger = new Logger(GeoIpService.name);
  private readonly cache = new Map<string, { value: GeoResult; at: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor(private prisma: PrismaService) {}

  /**
   * 从 request headers + ip 解析地理位置
   * 返回 { country, regionCode, city }；解析失败返回 {}
   */
  async lookup(req: { headers?: Record<string, any>; ip?: string }): Promise<GeoResult> {
    // 优先 Cloudflare header
    const cfCountry = this.readHeader(req.headers?.['cf-ipcountry']);
    if (cfCountry && /^[A-Z]{2}$/.test(cfCountry) && cfCountry !== 'XX' && cfCountry !== 'T1') {
      const cfCity = this.readHeader(req.headers?.['cf-ipcity']);
      const cfRegion = this.readHeader(req.headers?.['cf-region-code']);
      return {
        country: cfCountry,
        city: cfCity || undefined,
        regionCode: cfRegion ? `${cfCountry}-${cfRegion}` : undefined,
      };
    }

    // 回退 ipapi.co
    const ip = this.extractIp(req);
    if (!ip || this.isPrivateIp(ip)) return {};

    // 缓存命中
    const cached = this.cache.get(ip);
    if (cached && Date.now() - cached.at < this.CACHE_TTL) return cached.value;

    try {
      const resp = await axios.get(`https://ipapi.co/${ip}/json/`, {
        timeout: 5000,
        headers: { 'User-Agent': 'StarLensAI/1.0' },
      });
      const data = resp.data || {};
      if (data.error) {
        this.logger.warn(`[GeoIp] ipapi.co error for ${ip}: ${data.reason}`);
        return {};
      }
      const result: GeoResult = {
        country: typeof data.country_code === 'string' && data.country_code.length === 2 ? data.country_code : undefined,
        city: typeof data.city === 'string' && data.city.length > 0 ? data.city : undefined,
        regionCode: data.country_code && data.region_code
          ? `${data.country_code}-${data.region_code}`
          : undefined,
      };
      this.cache.set(ip, { value: result, at: Date.now() });
      // 限制缓存大小
      if (this.cache.size > 5000) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
      return result;
    } catch (err: any) {
      this.logger.warn(`[GeoIp] lookup failed for ${ip}: ${err?.message}`);
      return {};
    }
  }

  /**
   * 为用户写入地理位置（如果当前 country 为空）
   * fire-and-forget：不抛错，不阻塞调用方
   */
  async backfillUserGeo(userId: string, req: { headers?: Record<string, any>; ip?: string }): Promise<void> {
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { country: true, regionCode: true },
      });
      // 已有国家就不覆盖
      if (u?.country && u?.regionCode) return;

      const geo = await this.lookup(req);
      if (!geo.country && !geo.city && !geo.regionCode) return;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          country: u?.country ?? geo.country,
          regionCode: u?.regionCode ?? geo.regionCode,
          // city 不存（schema 没 city 字段，避免 migration；保留在日志即可）
        },
      });
    } catch (err: any) {
      this.logger.warn(`[GeoIp] backfill failed for user=${userId}: ${err?.message}`);
    }
  }

  private readHeader(v: any): string | null {
    if (Array.isArray(v)) return v[0] || null;
    if (typeof v === 'string') return v.trim() || null;
    return null;
  }

  private extractIp(req: { headers?: Record<string, any>; ip?: string }): string | null {
    // 优先 X-Forwarded-For 第一个（Railway/Cloudflare 都注入）
    const xff = this.readHeader(req.headers?.['x-forwarded-for']);
    if (xff) {
      const first = xff.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = this.readHeader(req.headers?.['x-real-ip']);
    if (realIp) return realIp;
    return req.ip ?? null;
  }

  private isPrivateIp(ip: string): boolean {
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('172.')) {
      const second = parseInt(ip.split('.')[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // IPv6 unique local
    return false;
  }
}

export interface GeoResult {
  country?: string;
  city?: string;
  regionCode?: string;
}
