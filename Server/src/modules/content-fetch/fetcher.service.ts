/**
 * V3-K 抓取服务
 *
 * 职责：
 *   - 按 type ('intel' | 'knowledge') 从配置的 sources 拉原文
 *   - RSS: rss-parser
 *   - HTML: axios + cheerio
 *   - 30 天滑窗去重（PrismaService 查 sourceUrl + titleHash 是否已存在）
 *   - 返回标准化 RawItem[]
 *
 * 不做：调 AI、不写库。下游由 Rewriter / JobService 处理。
 */

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
// rss-parser 是 CJS（module.exports = Parser），不能用 default import
// 不开 esModuleInterop 时 `import Parser from 'rss-parser'` 编译后是 .default，运行时报 not a constructor
// 用 require 形式拿到真正的构造函数
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parser = require('rss-parser');
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SOURCES,
  SourceCategory,
  SourceConfig,
  sourcesByCategory,
} from './sources.config';

export interface SourceStat {
  sourceKey: string;
  sourceName: string;
  /** 'ok' = 拉到内容；'empty' = 拉成功但 0 条（selector 不对或源本身空）；'failed' = 网络/解析异常 */
  status: 'ok' | 'empty' | 'failed';
  found: number;
  tookMs: number;
  error?: string;
}

export interface RawItem {
  /** 源配置 key */
  sourceKey: string;
  sourceName: string;
  /** 原文语言 */
  sourceLanguage: 'zh' | 'en';
  title: string;
  /** 摘要 / 简介 / 描述 */
  summary?: string;
  /** 详情链接（绝对 URL） */
  sourceUrl: string;
  /** 发布日期（解析得到则填） */
  publishedAt?: Date;
  /** 从 RSS content/description 抽出来的首张图 URL（用作 coverImage） */
  imageUrl?: string;
  /** 给去重用的哈希 = sha1(sourceUrl + normalizedTitle) */
  fingerprint: string;
}

@Injectable()
export class FetcherService {
  private readonly logger = new Logger(FetcherService.name);
  private readonly rssParser = new Parser({
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
    },
  });

  constructor(private prisma: PrismaService) {}

  /**
   * 返回标准化、已去重的候选 + 各源的诊断（admin UI 用于排查"为啥 0 条"）
   */
  async fetchAll(category: SourceCategory): Promise<{
    items: RawItem[];
    sourceStats: SourceStat[];
    duplicatedInDb: number;
  }> {
    const sources = sourcesByCategory(category);
    const all: RawItem[] = [];
    const stats: SourceStat[] = [];

    // 并发抓取每个源，单源失败不影响整体
    await Promise.all(
      sources.map(async (s) => {
        const startedAt = Date.now();
        try {
          const items = await this.fetchOne(s);
          const tookMs = Date.now() - startedAt;
          this.logger.log(`[FETCH] ${s.key} found=${items.length} in ${tookMs}ms`);
          stats.push({
            sourceKey: s.key,
            sourceName: s.name,
            status: items.length > 0 ? 'ok' : 'empty',
            found: items.length,
            tookMs,
          });
          all.push(...items);
        } catch (err: any) {
          const tookMs = Date.now() - startedAt;
          const msg = err?.message ?? String(err);
          this.logger.warn(`[FETCH] ${s.key} failed: ${msg}`);
          stats.push({
            sourceKey: s.key,
            sourceName: s.name,
            status: 'failed',
            found: 0,
            tookMs,
            error: msg.slice(0, 300),
          });
        }
      }),
    );

    // 同次抓取内的 fingerprint 去重（不同源可能同一新闻）
    const seenInBatch = new Set<string>();
    const uniqueInBatch: RawItem[] = [];
    for (const it of all) {
      if (seenInBatch.has(it.fingerprint)) continue;
      seenInBatch.add(it.fingerprint);
      uniqueInBatch.push(it);
    }

    // 30 天滑窗去重
    const filtered = await this.filterAlreadyInDb(uniqueInBatch);
    return {
      items: filtered,
      sourceStats: stats,
      duplicatedInDb: uniqueInBatch.length - filtered.length,
    };
  }

  /** 单源拉取 */
  private async fetchOne(s: SourceConfig): Promise<RawItem[]> {
    const max = s.maxItems ?? 5;
    if (s.kind === 'rss') {
      return this.fetchRss(s, max);
    }
    return this.fetchHtml(s, max);
  }

  private async fetchRss(s: SourceConfig, max: number): Promise<RawItem[]> {
    const feed = (await this.rssParser.parseURL(s.url)) as { items?: any[] };
    const items: any[] = (feed.items ?? []).slice(0, max);
    return items
      .map((i: any) => {
        const title = (i.title ?? '').trim();
        const link = (i.link ?? '').trim();
        if (!title || !link) return null;
        const summary = (i.contentSnippet ?? i.content ?? i.summary ?? '')
          .toString()
          .slice(0, 800);
        const publishedAt = i.isoDate ? new Date(i.isoDate) : undefined;
        // 从多个候选字段抽首张图：enclosure / media:content / content HTML
        const imageUrl = this.extractImageFromRssItem(i);
        return {
          sourceKey: s.key,
          sourceName: s.name,
          sourceLanguage: s.language,
          title,
          summary,
          sourceUrl: link,
          publishedAt,
          imageUrl,
          fingerprint: this.fingerprint(link, title),
        } as RawItem;
      })
      .filter((x: RawItem | null): x is RawItem => !!x);
  }

  /** 从 RSS item 抽首张图 URL（覆盖 enclosure / mediaContent / 正文 HTML <img>） */
  private extractImageFromRssItem(i: any): string | undefined {
    // 1) <enclosure type="image/..." url="...">
    if (i.enclosure?.url && typeof i.enclosure.url === 'string') {
      const t: string = i.enclosure.type ?? '';
      if (!t || t.startsWith('image/')) return i.enclosure.url;
    }
    // 2) <media:content url="..."> 或 <media:thumbnail url="...">
    const mc = i['media:content']?.['$']?.url ?? i.mediaContent?.[0]?.['$']?.url;
    if (typeof mc === 'string' && mc) return mc;
    const mt = i['media:thumbnail']?.['$']?.url ?? i.mediaThumbnail?.[0]?.['$']?.url;
    if (typeof mt === 'string' && mt) return mt;
    // 3) content / contentEncoded / description 里的 <img src="...">
    const html = (i['content:encoded'] ?? i.content ?? i.description ?? '').toString();
    if (html) {
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m?.[1]) return m[1];
    }
    return undefined;
  }

  private async fetchHtml(s: SourceConfig, max: number): Promise<RawItem[]> {
    const html = s.html!;
    const resp = await axios.get(s.url, {
      timeout: s.timeoutMs ?? 12000,
      headers: { 'User-Agent': s.userAgent ?? 'Mozilla/5.0' },
      // 一些政府网站走 gzip 需要默认 decode
      responseType: 'text',
      maxRedirects: 3,
      validateStatus: (st) => st < 400,
    });
    const $ = cheerio.load(resp.data);
    const items = $(html.itemSelector).toArray().slice(0, max * 2); // 多取点，title 空的会被过滤
    const out: RawItem[] = [];
    for (const el of items) {
      const title = $(el).find(html.titleSelector).first().text().trim();
      let link = $(el)
        .find(html.linkSelector)
        .first()
        .attr(html.linkAttr ?? 'href')
        ?.trim();
      if (!title || !link) continue;
      if (link.startsWith('/')) link = (html.baseUrl ?? s.url.replace(/\/[^/]*$/, '')) + link;
      else if (!link.startsWith('http')) continue;
      const summary = html.summarySelector
        ? $(el).find(html.summarySelector).first().text().trim().slice(0, 600)
        : undefined;
      const publishedAt = html.dateSelector
        ? this.parseDate($(el).find(html.dateSelector).first().text().trim())
        : undefined;
      out.push({
        sourceKey: s.key,
        sourceName: s.name,
        sourceLanguage: s.language,
        title,
        summary,
        sourceUrl: link,
        publishedAt,
        fingerprint: this.fingerprint(link, title),
      });
      if (out.length >= max) break;
    }
    return out;
  }

  private fingerprint(url: string, title: string): string {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '').slice(0, 200);
    return createHash('sha1').update(norm(url) + '|' + norm(title)).digest('hex');
  }

  private parseDate(s: string): Date | undefined {
    if (!s) return undefined;
    const d = new Date(s);
    if (isNaN(d.getTime())) return undefined;
    return d;
  }

  /**
   * 30 天去重：
   *   - 查 intel_alerts / knowledge_cases 里 source_url 命中或 title 重复
   *   - 命中即过滤
   */
  private async filterAlreadyInDb(items: RawItem[]): Promise<RawItem[]> {
    if (items.length === 0) return [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const urls = items.map((i) => i.sourceUrl).filter(Boolean);
    const titles = items.map((i) => i.title).filter(Boolean);

    const [intelHits, knowledgeHits] = await Promise.all([
      this.prisma.intelAlert.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          OR: [
            { sourceUrl: { in: urls } },
            { title: { in: titles } },
          ],
        },
        select: { sourceUrl: true, title: true },
      }),
      this.prisma.knowledgeCase.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          OR: [
            { source: { in: urls } },
            { title: { in: titles } },
          ],
        },
        select: { source: true, title: true },
      }),
    ]);

    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    for (const h of intelHits) {
      if (h.sourceUrl) seenUrls.add(h.sourceUrl);
      if (h.title) seenTitles.add(h.title);
    }
    for (const h of knowledgeHits) {
      if (h.source) seenUrls.add(h.source);
      if (h.title) seenTitles.add(h.title);
    }

    return items.filter((i) => !seenUrls.has(i.sourceUrl) && !seenTitles.has(i.title));
  }
}
