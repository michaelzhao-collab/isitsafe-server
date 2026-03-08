import request from './request';

export interface AnalyticsOverview {
  todayQueries?: number;
  todayAiCalls?: number;
  riskDistribution?: { low?: number; medium?: number; high?: number; unknown?: number };
  highRiskCount?: number;
  totalUsers?: number;
}

export interface RiskStats {
  byLevel?: Record<string, number>;
  highRiskSamples?: unknown[];
}

export interface DailyQueries {
  date: string;
  count: number;
}

/** Dashboard / 数据统计：优先 /admin/analytics/overview，不存在时用 /admin/ai/stats 拼装 */
export function getAnalyticsOverview() {
  return request
    .get<AnalyticsOverview>('/admin/analytics/overview')
    .catch(() => request.get('/admin/ai/stats').then((r: any) => ({
      todayQueries: r?.totalQueries ?? 0,
      todayAiCalls: r?.aiLogsTotal ?? 0,
      highRiskCount: r?.highRiskCount ?? 0,
      totalUsers: undefined,
      riskDistribution: undefined,
    })));
}

export function getRiskStats(params?: { startDate?: string; endDate?: string }) {
  return request
    .get<RiskStats>('/admin/analytics/risk-stats', { params: params })
    .catch(() => ({ byLevel: {}, highRiskSamples: [] }));
}

export function getDailyQueries(params?: { startDate?: string; endDate?: string }) {
  return request
    .get<DailyQueries[]>('/admin/analytics/daily-queries', { params: params })
    .catch(() => []);
}
