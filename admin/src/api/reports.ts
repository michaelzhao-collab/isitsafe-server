import request from './request';

export type ReportStatus = 'PENDING' | 'HANDLED' | 'REJECTED';

export interface ReportItem {
  id: string;
  userId: string | null;
  type: string;
  content: string;
  status: ReportStatus;
  createdAt: string;
  user?: { id: string; phone: string | null; email: string | null };
}

export interface ReportsRes {
  items: ReportItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReportStats {
  pending: number;
  handled: number;
  rejected: number;
  total: number;
}

export function getReports(params?: { page?: number; pageSize?: number; status?: ReportStatus }) {
  const q: Record<string, string> = {};
  if (params?.page != null) q.page = String(params.page);
  if (params?.pageSize != null) q.pageSize = String(params.pageSize);
  if (params?.status) q.status = params.status;
  return request.get<ReportsRes>('/admin/reports', { params: q });
}

export function updateReportStatus(id: string, status: ReportStatus, remark?: string) {
  return request.put(`/admin/reports/${id}/status`, { status, remark });
}

export function getReportStats() {
  return request.get<ReportStats>('/admin/reports/stats');
}
