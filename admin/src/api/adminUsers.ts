import request from './request';

export type AdminRole = 'super_admin' | 'admin';

export interface AdminUserItem {
  id: string;
  username?: string;
  phone?: string;
  email?: string;
  role: AdminRole;
  createdAt?: string;
}

export interface AdminUsersRes {
  items: AdminUserItem[];
  total?: number;
}

export function getAdminUsers(params?: { page?: number; pageSize?: number }) {
  const q: Record<string, string> = {};
  if (params?.page != null) q.page = String(params.page);
  if (params?.pageSize != null) q.pageSize = String(params.pageSize);
  return request.get<AdminUsersRes>('/admin/admin-users', { params: q }).catch(() => ({ items: [], total: 0 }));
}

export function createAdminUser(data: { username?: string; phone?: string; email?: string; role: AdminRole; password?: string }) {
  return request.post<AdminUserItem>('/admin/admin-users', data);
}

export function updateAdminUser(id: string, data: Partial<AdminUserItem> & { password?: string }) {
  return request.put<AdminUserItem>(`/admin/admin-users/${id}`, data);
}
