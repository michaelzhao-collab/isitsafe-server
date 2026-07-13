import request from './request';

export type DailyScamStatus = 'pending' | 'approved' | 'rejected' | 'sent';

export interface DailyScamCandidate {
  id: string;
  title: string;
  summary: string;
  riskLevel: string;
  refType?: string | null;
  refId?: string | null;
  deepLink?: string | null;
  scheduledDate: string;
  status: DailyScamStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  sentAt?: string | null;
  sentGroupCount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyScamListResponse {
  items: DailyScamCandidate[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DailyScamInput {
  title: string;
  summary: string;
  riskLevel?: string;
  deepLink?: string | null;
  scheduledDate: string; // yyyy-MM-dd
}

// 响应拦截器已 unwrap res.data，但 axios 类型仍是 AxiosResponse<T>，故在此统一 cast 为 Promise<T>
export function listDailyScam(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<DailyScamListResponse> {
  return request.get('/admin/daily-scam', {
    params: {
      ...(params.status && { status: params.status }),
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 30,
    },
  }) as unknown as Promise<DailyScamListResponse>;
}

export function createDailyScam(body: DailyScamInput): Promise<DailyScamCandidate> {
  return request.post('/admin/daily-scam', body) as unknown as Promise<DailyScamCandidate>;
}

export function updateDailyScam(id: string, body: Partial<DailyScamInput>): Promise<DailyScamCandidate> {
  return request.put(`/admin/daily-scam/${id}`, body) as unknown as Promise<DailyScamCandidate>;
}

export function reviewDailyScam(id: string, action: 'approve' | 'reject'): Promise<void> {
  return request.post(`/admin/daily-scam/${id}/review`, { action }) as unknown as Promise<void>;
}

export function sendDailyScamNow(id: string): Promise<{ success: boolean; groups: number }> {
  return request.post(`/admin/daily-scam/${id}/send-now`, {}) as unknown as Promise<{
    success: boolean;
    groups: number;
  }>;
}

export function deleteDailyScam(id: string): Promise<void> {
  return request.delete(`/admin/daily-scam/${id}`) as unknown as Promise<void>;
}
