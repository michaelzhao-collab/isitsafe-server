import request from './request';

export interface AiProviderItem {
  id: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  enabled: boolean;
}

export interface AiProvidersRes {
  items?: AiProviderItem[];
  defaultProvider?: string;
}

/** 当前 Server 暴露：GET /admin/settings 含 defaultProvider；GET /admin/ai/stats、/admin/ai/logs */
export function getAiProviders() {
  return request.get<AiProvidersRes>('/admin/ai/providers').catch(() => ({ items: [], defaultProvider: 'doubao' }));
}

export function createAiProvider(data: Partial<AiProviderItem>) {
  return request.post<AiProviderItem>('/admin/ai/providers', data);
}

export function updateAiProvider(id: string, data: Partial<AiProviderItem>) {
  return request.put<AiProviderItem>(`/admin/ai/providers/${id}`, data);
}

export function activateAiProvider(id: string) {
  return request.put(`/admin/ai/providers/activate/${id}`);
}

export function getAiStats(params?: { startDate?: string; endDate?: string }) {
  return request.get<{ totalQueries: number; highRiskCount: number; aiLogsTotal: number; byProvider?: unknown[] }>(
    '/admin/ai/stats',
    { params: params }
  );
}

export function getAiLogs(params?: { page?: number; pageSize?: number; startDate?: string; endDate?: string }) {
  return request.get<{ items: unknown[]; total: number }>('/admin/ai/logs', { params: params });
}
