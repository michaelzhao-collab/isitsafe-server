import request from './request';

export type IntelSeverity = 'normal' | 'high' | 'urgent';
export type IntelStatus = 'draft' | 'pending' | 'published' | 'archived';

export interface IntelAlert {
  id: string;
  title: string;
  summary: string;
  contentBlocks?: unknown;
  category: string;
  severity: IntelSeverity;
  targetRegions: string[];
  targetAudiences: string[];
  language: string;
  sourceUrl?: string | null;
  status: IntelStatus;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntelAlertListResponse {
  items: IntelAlert[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IntelSubmission {
  id: string;
  userId: string;
  category?: string | null;
  content: string;
  attachments?: string[] | null;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  mergedToIntelId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntelSubmissionListResponse {
  items: IntelSubmission[];
  total: number;
  page: number;
  pageSize: number;
}

export function listAlerts(params: {
  status?: string;
  language?: string;
  page?: number;
  pageSize?: number;
}) {
  return request.get<IntelAlertListResponse>('/admin/intel/alerts', {
    params: {
      ...(params.status && { status: params.status }),
      ...(params.language && { language: params.language }),
      ...(params.page && { page: String(params.page) }),
      ...(params.pageSize && { pageSize: String(params.pageSize) }),
    },
  });
}

export function createAlert(data: Partial<IntelAlert>) {
  return request.post<IntelAlert>('/admin/intel/alerts', data);
}

export function updateAlert(id: string, data: Partial<IntelAlert>) {
  return request.put<IntelAlert>(`/admin/intel/alerts/${id}`, data);
}

export function deleteAlert(id: string) {
  return request.delete(`/admin/intel/alerts/${id}`);
}

export function listSubmissions(params: { status?: string; page?: number; pageSize?: number }) {
  return request.get<IntelSubmissionListResponse>('/admin/intel/submissions', {
    params: {
      ...(params.status && { status: params.status }),
      ...(params.page && { page: String(params.page) }),
      ...(params.pageSize && { pageSize: String(params.pageSize) }),
    },
  });
}

export function reviewSubmission(id: string, action: 'approve' | 'reject' | 'merge', mergedToIntelId?: string) {
  return request.post(`/admin/intel/submissions/${id}/review`, { action, mergedToIntelId });
}

/** S4-2 AI 改写：把原始草稿改写为更紧凑的"套路 3 步 + 防范建议"结构 */
export function aiRewriteIntel(payload: {
  title?: string;
  summary?: string;
  language?: string;
}) {
  return request.post<{
    summary: string;
    contentBlocks: Array<{ type: string; text: string }>;
    provider?: string;
  }>('/admin/intel/ai-rewrite', payload);
}
