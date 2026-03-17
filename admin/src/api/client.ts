// 默认走线上正式接口（也可用 .env 覆盖）
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.starlensai.com/api';
const BASE = API_BASE;

function getToken(): string | null {
  return localStorage.getItem('adminToken');
}

export async function request<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<T> {
  const { params, ...rest } = options;
  let url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (params && Object.keys(params).length) {
    url += '?' + new URLSearchParams(params).toString();
  }
  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...rest.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || res.statusText || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ accessToken: string }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      headers: {},
    }),
  users: (params?: { page?: number; pageSize?: number; country?: string }) =>
    request<{ items: any[]; total: number }>('/admin/users', { params: params as any }),
  queries: (params?: { page?: number; pageSize?: number; status?: string }) =>
    request<{ items: any[]; total: number }>('/admin/queries', { params: params as any }),
  reports: (params?: { page?: number; pageSize?: number; status?: string }) =>
    request<{ items: any[]; total: number }>('/admin/reports', { params: params as any }),
  reportStats: () => request<{ pending: number; handled: number; rejected: number; total: number }>('/admin/reports/stats'),
  reportStatus: (id: string, status: string) =>
    request(`/admin/reports/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  knowledge: (params?: { page?: number; pageSize?: number; category?: string; search?: string; language?: string }) =>
    request<{ items: any[]; total: number }>('/admin/knowledge', { params: params as any }),
  knowledgeUpload: (body: { title: string; content: string; category: string; tags?: string[] }) =>
    request('/admin/knowledge/upload', { method: 'POST', body: JSON.stringify(body) }),
  knowledgeUpdate: (id: string, body: { title?: string; content?: string; category?: string; tags?: string[] }) =>
    request(`/admin/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  knowledgeDelete: (id: string) => request(`/admin/knowledge/${id}`, { method: 'DELETE' }),
  aiLogs: (params?: { page?: number; pageSize?: number }) =>
    request<{ items: any[]; total: number }>('/admin/ai/logs', { params: params as any }),
  aiStats: (params?: { startDate?: string; endDate?: string }) =>
    request<{ totalQueries: number; byStatus: any[]; highRiskCount: number }>('/admin/ai/stats', { params: params as any }),
  subscriptionLogs: () => request<any[]>('/admin/subscription/logs'),
  subscriptionOrders: (params?: { page?: number; pageSize?: number; status?: string }) =>
    request<{ items: SubscriptionOrderItem[]; total: number; page: number; pageSize: number }>(
      '/admin/subscription/orders',
      { params: params as Record<string, string> }
    ),
  messages: (params?: { page?: number; pageSize?: number }) =>
    request<{ items: Array<{ id: string; title: string; content: string; link: string | null; language: string; status: string; createdAt: string }>; total: number }>(
      '/admin/messages',
      { params: params as any }
    ),
  messagesCreate: (body: { titleZh?: string; contentZh?: string; titleEn?: string; contentEn?: string; link?: string }) =>
    request<{ items: Array<{ id: string }> }>('/admin/messages', { method: 'POST', body: JSON.stringify(body) }),
  messagesSetOffline: (id: string) =>
    request<{ ok: boolean }>(`/admin/messages/${id}/offline`, { method: 'PATCH' }),
  feedback: (params?: { page?: number; pageSize?: number }) =>
    request<{ items: Array<{ id: string; userId: string | null; content: string; imageUrl: string | null; createdAt: string }>; total: number }>(
      '/admin/feedback',
      { params: params as any }
    ),
  membershipPlans: () => request<MembershipPlanItem[]>('/admin/membership/plans'),
  membershipPlanCreate: (body: MembershipPlanCreate) =>
    request<MembershipPlanItem>('/admin/membership/plans', { method: 'POST', body: JSON.stringify(body) }),
  membershipPlanUpdate: (id: string, body: Partial<MembershipPlanCreate>) =>
    request<MembershipPlanItem>(`/admin/membership/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  membershipPlanDelete: (id: string) =>
    request<{ success: boolean }>(`/admin/membership/plans/${id}`, { method: 'DELETE' }),
  knowledgeCategories: (params?: { includeOffline?: boolean }) =>
    request<Array<{ id: string; key: string; nameZh: string; nameEn: string; status: string; sortOrder: number; createdAt: string }>>(
      '/admin/knowledge-categories',
      { params: (params as any) || {} }
    ),
  createKnowledgeCategory: (body: {
    key: string;
    nameZh: string;
    nameEn: string;
    sortOrder?: number;
    status?: string;
  }) =>
    request('/admin/knowledge-categories', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateKnowledgeCategory: (
    id: string,
    body: {
      nameZh?: string;
      nameEn?: string;
      sortOrder?: number;
      status?: string;
    }
  ) =>
    request(`/admin/knowledge-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteKnowledgeCategory: (id: string) =>
    request<{ success: boolean }>(`/admin/knowledge-categories/${id}`, { method: 'DELETE' }),
  updateKnowledgeCategoryStatus: (id: string, status: 'active' | 'offline') =>
    request(`/admin/knowledge-categories/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export interface MembershipPlanItem {
  id: string;
  name: string;
  productId: string;
  price: number;
  currency: string;
  period: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  isRecommended: boolean;
  createdAt: string;
}

export interface MembershipPlanCreate {
  name: string;
  productId: string;
  price: number;
  currency: string;
  period: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  isRecommended?: boolean;
}

export interface SubscriptionOrderItem {
  id: string;
  userId: string;
  productId: string;
  planType: string;
  status: string;
  expireTime: string;
  transactionId: string | null;
  paymentMethod: string;
  createdAt: string;
  user: { id: string; phone: string | null; nickname: string | null; email: string | null };
}
