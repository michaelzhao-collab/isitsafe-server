import request from './request';

export type RiskType = 'phone' | 'url' | 'company' | 'wallet' | 'keyword';

export interface RiskItem {
  id: string;
  type: RiskType;
  content: string;
  riskLevel: string;
  riskCategory: string | null;
  source: string | null;
  tags: string[];
  createdAt: string;
}

export interface RiskListRes {
  items: RiskItem[];
  total: number;
  page?: number;
  pageSize?: number;
}

export function getRiskData(params?: { page?: number; pageSize?: number; type?: string; riskLevel?: string }) {
  const q: Record<string, string> = {};
  if (params?.page != null) q.page = String(params.page);
  if (params?.pageSize != null) q.pageSize = String(params.pageSize);
  if (params?.type) q.type = params.type;
  if (params?.riskLevel) q.riskLevel = params.riskLevel;
  return request.get<RiskListRes>('/admin/risk-data', { params: q });
}

export function createRiskData(data: Partial<RiskItem>) {
  return request.post<RiskItem>('/admin/risk-data', data);
}

export function updateRiskData(id: string, data: Partial<RiskItem>) {
  return request.put<RiskItem>(`/admin/risk-data/${id}`, data);
}

export function deleteRiskData(id: string) {
  return request.delete(`/admin/risk-data/${id}`);
}
