import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

/**
 * V3-A1 语音深伪检测服务
 *
 * 一期 stub 实现：
 *  - 服务端接收文件 url（客户端先上 R2）
 *  - 同步 mock AI（按文件大小+确定性算法返回 score/label）
 *  - 真实 provider 二期接入（Reality Defender / Pindrop / 火山引擎）
 *
 * 隐私要求：file_url 24h 后自动清空（保留检测记录）
 */
@Injectable()
export class DeepfakeService {
  private readonly logger = new Logger(DeepfakeService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 创建检测任务（同步返回 stub 结果）
   */
  async createCheck(params: {
    userId: string;
    sourceType: 'upload' | 'record' | 'share';
    fileUrl: string;
    fileDurationSec?: number;
  }) {
    // SSRF 防御：fileUrl 必须是本项目 CDN 域名，防止用户传任意 URL 触发外发请求
    this.assertOwnCdnUrl(params.fileUrl);

    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 3600 * 1000);

    const check = await this.prisma.deepfakeCheck.create({
      data: {
        userId: params.userId,
        checkType: 'voice',
        sourceType: params.sourceType,
        fileUrl: params.fileUrl,
        fileDurationSec: params.fileDurationSec,
        status: 'processing',
        expiresAt: expires,
      },
    });

    // Provider 失败 fallback 链：Reality Defender → 火山引擎 → stub
    // stub provider 仅几毫秒；真实 provider 30s timeout
    // 一期同步等待结果（客户端体验：录音上传后等几秒看结果）；二期切异步轮询
    try {
      const { result, providerName, raw } = await this.analyzeWithFallback(params.fileUrl, params.fileDurationSec ?? 30);
      const updated = await this.prisma.deepfakeCheck.update({
        where: { id: check.id },
        data: {
          status: 'done',
          resultScore: result.score,
          resultLabel: result.label,
          resultFeatures: result.features as any,
          aiProvider: providerName,
          aiRawResponse: raw as any,
          completedAt: new Date(),
        },
      });
      return updated;
    } catch (err: any) {
      // 整体失败也不阻塞客户端：标记 failed 让用户重试
      this.logger.error(`[Deepfake] all providers failed: ${err?.message}`);
      return this.prisma.deepfakeCheck.update({
        where: { id: check.id },
        data: { status: 'failed', completedAt: new Date() },
      });
    }
  }

  /**
   * 校验 fileUrl 是本项目 CDN 域名（CDN_DOMAIN env）
   * 防止用户传任意 URL → 服务端把 URL 转发到 Reality Defender / Volcengine
   * 攻击场景：用户传 https://attacker.com/file.m4a → 第三方 AI 拿数据 → 用户的私有信息外泄
   */
  private assertOwnCdnUrl(fileUrl: string): void {
    const cdn = (process.env.CDN_DOMAIN || '').replace(/\/$/, '');
    if (!cdn) {
      // 未配 CDN_DOMAIN（dev 环境）放行，但记日志
      this.logger.warn('[Deepfake] CDN_DOMAIN not set, fileUrl validation skipped');
      return;
    }
    let url: URL;
    try {
      url = new URL(fileUrl);
    } catch {
      throw new BadRequestException('Invalid fileUrl');
    }
    let cdnUrl: URL;
    try {
      cdnUrl = new URL(cdn);
    } catch {
      this.logger.warn(`[Deepfake] CDN_DOMAIN invalid: ${cdn}`);
      return;
    }
    if (url.protocol !== 'https:') {
      throw new BadRequestException('fileUrl must be https');
    }
    if (url.host !== cdnUrl.host) {
      throw new BadRequestException('fileUrl host not allowed');
    }
  }

  // ====================================================================
  // AI Provider 抽象 + Failover
  // ====================================================================
  private async analyzeWithFallback(
    fileUrl: string,
    durationSec: number,
  ): Promise<{
    result: { score: number; label: 'low' | 'medium' | 'high'; features: Array<{ name: string; severity: 'low' | 'medium' | 'high'; description: string }> };
    providerName: string;
    raw: any;
  }> {
    // 优先 1: Reality Defender（海外）
    if (process.env.REALITY_DEFENDER_API_KEY) {
      try {
        const r = await this.callRealityDefender(fileUrl);
        return { result: r.result, providerName: 'reality_defender', raw: r.raw };
      } catch (err: any) {
        this.logger.warn(`[Deepfake] Reality Defender failed: ${err?.message}`);
      }
    }
    // 优先 2: 火山引擎（国内）
    if (process.env.VOLCENGINE_AK && process.env.VOLCENGINE_SK) {
      try {
        const r = await this.callVolcEngine(fileUrl);
        return { result: r.result, providerName: 'volcengine', raw: r.raw };
      } catch (err: any) {
        this.logger.warn(`[Deepfake] Volcengine failed: ${err?.message}`);
      }
    }
    // Fallback: stub
    const stub = this.stubAnalyze(fileUrl, durationSec);
    return { result: stub, providerName: 'stub_v1', raw: { stub: true } };
  }

  /**
   * Reality Defender 调用占位
   * 真实 API 见 https://api.realitydefender.com（v2 endpoint：POST /api/v2/audio/analyze）
   * 需要预先把 file_url（R2）转成可访问 URL；账号开通后填详细 URL 路径
   */
  private async callRealityDefender(fileUrl: string): Promise<{
    result: { score: number; label: 'low' | 'medium' | 'high'; features: any[] };
    raw: any;
  }> {
    const endpoint = process.env.REALITY_DEFENDER_API_URL || 'https://api.realitydefender.com/api/v2/audio/analyze';
    const resp = await axios.post(
      endpoint,
      { fileUrl },
      {
        headers: {
          'X-API-Key': process.env.REALITY_DEFENDER_API_KEY!,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );
    // 响应字段按真实 API 文档调整；此处假设 { score: 0~1, label: 'real'|'fake', features?: [] }
    const score = Number(resp.data?.score ?? resp.data?.aiProbability ?? 0);
    const label: 'low' | 'medium' | 'high' = score < 0.30 ? 'low' : score < 0.70 ? 'medium' : 'high';
    return {
      result: {
        score,
        label,
        features: resp.data?.features || [],
      },
      raw: resp.data,
    };
  }

  /**
   * 火山引擎语音 AI 调用占位
   * 真实 API 见 https://www.volcengine.com/docs/6561（声纹/合成检测）
   * 需要 AK/SK 签名（HMAC-SHA256），生产建议用 @volcengine/openapi 或自实现签名
   */
  private async callVolcEngine(fileUrl: string): Promise<{
    result: { score: number; label: 'low' | 'medium' | 'high'; features: any[] };
    raw: any;
  }> {
    // 火山签名复杂；一期留 throw 让 fallback 到 stub
    throw new Error('Volcengine signing not yet implemented (configure SDK and uncomment)');
  }

  async getResult(userId: string, taskId: string) {
    const check = await this.prisma.deepfakeCheck.findUnique({
      where: { id: taskId },
    });
    if (!check) throw new NotFoundException('Task not found');
    if (check.userId !== userId) throw new ForbiddenException('Not your task');
    return check;
  }

  async getMyHistory(userId: string, limit = 50) {
    return this.prisma.deepfakeCheck.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        checkType: true,
        sourceType: true,
        fileDurationSec: true,
        resultScore: true,
        resultLabel: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }

  async deleteCheck(userId: string, taskId: string) {
    const check = await this.prisma.deepfakeCheck.findUnique({
      where: { id: taskId },
    });
    if (!check) throw new NotFoundException();
    if (check.userId !== userId) throw new ForbiddenException();
    await this.prisma.deepfakeCheck.delete({ where: { id: taskId } });
    return { success: true };
  }

  async submitFeedback(userId: string, taskId: string, feedback: 'accurate' | 'inaccurate') {
    const check = await this.prisma.deepfakeCheck.findUnique({
      where: { id: taskId },
    });
    if (!check || check.userId !== userId) {
      throw new NotFoundException();
    }
    await this.prisma.deepfakeCheck.update({
      where: { id: taskId },
      data: { userFeedback: feedback },
    });
    return { success: true };
  }

  // ====================================================================
  // 24h 过期清理（每小时执行一次）
  // ====================================================================
  @Cron(CronExpression.EVERY_HOUR, { name: 'deepfake-r2-cleanup' })
  async cleanupExpiredFiles() {
    const now = new Date();
    const expired = await this.prisma.deepfakeCheck.findMany({
      where: {
        expiresAt: { lte: now },
        fileUrl: { not: null },
      },
      select: { id: true, fileUrl: true },
    });
    if (expired.length === 0) return;

    for (const r of expired) {
      // TODO: 调用 R2 deleteObject(r.fileUrl)
      // 一期占位仅清空 DB 字段
      await this.prisma.deepfakeCheck.update({
        where: { id: r.id },
        data: { fileUrl: null },
      });
    }
    this.logger.log(`[DeepfakeCleanup] cleaned ${expired.length} expired file refs`);
  }

  // ====================================================================
  // Stub AI 分析（一期占位，二期替换为真实 provider）
  // ====================================================================
  private stubAnalyze(fileUrl: string, durationSec: number): {
    score: number;
    label: 'low' | 'medium' | 'high';
    features: Array<{ name: string; severity: 'low' | 'medium' | 'high'; description: string }>;
  } {
    // 用 URL 末尾字符的 char code 作为确定性 hash → 稳定返回相同结果，方便测试
    const last = fileUrl.charCodeAt(fileUrl.length - 1);
    const seed = (last + durationSec) % 100;
    let score: number;
    if (seed < 30) score = 0.05 + (seed * 0.005);       // low
    else if (seed < 70) score = 0.30 + (seed * 0.004);  // medium
    else score = 0.75 + (seed * 0.002);                  // high

    const label: 'low' | 'medium' | 'high' =
      score < 0.30 ? 'low' : score < 0.70 ? 'medium' : 'high';

    const allFeatures: Array<{ name: string; severity: 'low' | 'medium' | 'high'; description: string }> = [
      {
        name: '呼吸节奏不自然',
        severity: 'high',
        description: '真人说话时换气有规律，AI 合成往往缺乏这种自然停顿',
      },
      {
        name: '音色细节缺失',
        severity: 'high',
        description: '高频段缺少应有的细节，类似压缩痕迹',
      },
      {
        name: '情感波动不连续',
        severity: 'medium',
        description: '在表达情绪转折时音调跨度异常生硬',
      },
      {
        name: '背景噪音模式异常',
        severity: 'medium',
        description: '背景噪声与口音节奏不一致',
      },
      {
        name: '频谱断层',
        severity: 'low',
        description: '某些频段出现规律性缺失',
      },
    ];

    // 根据 label 取不同数量的 features
    const count = label === 'high' ? 3 : label === 'medium' ? 2 : 1;
    const features = allFeatures.slice(0, count);

    return { score, label, features };
  }
}
