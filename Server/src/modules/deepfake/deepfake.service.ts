import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

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

    // Stub AI：实际生产替换为 provider API 调用（异步队列）
    const stub = this.stubAnalyze(params.fileUrl, params.fileDurationSec ?? 30);

    const updated = await this.prisma.deepfakeCheck.update({
      where: { id: check.id },
      data: {
        status: 'done',
        resultScore: stub.score,
        resultLabel: stub.label,
        resultFeatures: stub.features as any,
        aiProvider: 'stub_v1',
        aiRawResponse: { stub: true } as any,
        completedAt: new Date(),
      },
    });
    return updated;
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
