import request from './request';

export interface QueryItem {
  id: string;
  userId: string | null;
  inputType: string;
  content: string;
  /** 用户上传的截图/图片 CDN 地址（有则展示） */
  imageUrl?: string | null;
  riskLevel: string;
  confidence?: number;
  aiProvider?: string;
  createdAt: string;
  user?: { id: string; phone: string | null; email: string | null };
}

export interface QueriesRes {
  items: QueryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function getQueries(params?: {
  page?: number;
  pageSize?: number;
  riskLevel?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  const q: Record<string, string> = {};
  if (params?.page != null) q.page = String(params.page);
  if (params?.pageSize != null) q.pageSize = String(params.pageSize);
  if (params?.riskLevel) q.riskLevel = params.riskLevel;
  if (params?.startDate) q.startDate = params.startDate;
  if (params?.endDate) q.endDate = params.endDate;
  return request.get<QueriesRes>('/admin/queries', { params: q });
}

export function getQueryDetail(id: string) {
  return request.get<QueryItem>(`/admin/queries/${id}`);
}
