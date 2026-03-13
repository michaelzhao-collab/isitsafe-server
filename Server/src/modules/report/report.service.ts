import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportStatus } from '@prisma/client';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string | null, type: string, content: string, relatedQueryId?: string) {
    return this.prisma.report.create({
      data: { userId: userId ?? undefined, type, content, relatedQueryId },
    });
  }

  async getOne(id: string) {
    return this.prisma.report.findUnique({
      where: { id },
      include: { user: { select: { id: true, phone: true, email: true } } },
    });
  }

  async list(page = 1, pageSize = 20, status?: ReportStatus) {
    const skip = (page - 1) * pageSize;
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, phone: true, email: true } } },
      }),
      this.prisma.report.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async updateStatus(id: string, status: ReportStatus, handledBy: string) {
    return this.prisma.report.update({
      where: { id },
      data: { status, handledBy, handledAt: new Date() },
    });
  }

  async getStats() {
    const [pending, handled, rejected] = await Promise.all([
      this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.report.count({ where: { status: ReportStatus.HANDLED } }),
      this.prisma.report.count({ where: { status: ReportStatus.REJECTED } }),
    ]);
    return { pending, handled, rejected, total: pending + handled + rejected };
  }
}
