import request from './request';

export interface UserItem {
  id: string;
  phone: string | null;
  email: string | null;
  country: string | null;
  avatar: string | null;
  nickname: string | null;
  gender: string | null;
  birthday: string | null;
  role: string;
  createdAt: string;
  lastLogin: string | null;
  subscriptionStatus?: string;
  subscriptionExpire?: string | null;
  subscriptions?: Array<{ expireTime: string; status?: string }>;
}

export interface UsersRes {
  items: UserItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function getUsers(params?: { page?: number; pageSize?: number; country?: string; startDate?: string; endDate?: string }) {
  const q: Record<string, string> = {};
  if (params?.page != null) q.page = String(params.page);
  if (params?.pageSize != null) q.pageSize = String(params.pageSize);
  if (params?.country) q.country = params.country;
  return request.get<UsersRes>('/admin/users', { params: q });
}

export function updateUserStatus(id: string, status: string) {
  return request.put<{ id: string; status: string; success: boolean }>(`/admin/users/${id}/status`, { status });
}

export function updateUser(
  id: string,
  data: { avatar?: string; nickname?: string; gender?: string; birthday?: string }
) {
  return request.put<{ success: boolean }>(`/admin/users/${id}`, data);
}
