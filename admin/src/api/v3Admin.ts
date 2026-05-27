/**
 * V3 一期 admin 接口客户端（家庭/长辈/深伪/暗网）
 */
import request from './request';

// ============ 家庭守护 ============
export interface FamilyGroupItem {
  id: string;
  name: string;
  inviteCode: string;
  ownerUserId: string;
  owner: { id: string; nickname: string | null; phone: string | null };
  createdAt: string;
  _count: { members: number; broadcasts: number };
}

export interface FamilyBroadcastItem {
  id: string;
  groupId: string;
  triggeredByUserId: string;
  contentType: string;
  contentDisplay: string;
  resultLabel: string;
  source: string;
  createdAt: string;
}

export interface FamilyCareNoticeItem {
  id: string;
  groupId: string;
  inactiveUserId: string;
  notifiedUserIds: string[];
  daysInactive: number;
  channel: string;
  sentAt: string;
}

export const listFamilyGroups = (params: { page?: number; pageSize?: number; keyword?: string }) =>
  request.get<{ items: FamilyGroupItem[]; total: number }>('/admin/v3/family/groups', { params }) as unknown as Promise<{ items: FamilyGroupItem[]; total: number }>;

export const listFamilyBroadcasts = (params: { page?: number; pageSize?: number; groupId?: string }) =>
  request.get<{ items: FamilyBroadcastItem[]; total: number }>('/admin/v3/family/broadcasts', { params }) as unknown as Promise<{ items: FamilyBroadcastItem[]; total: number }>;

export const listFamilyCareNotices = (params: { page?: number; pageSize?: number }) =>
  request.get<{ items: FamilyCareNoticeItem[]; total: number }>('/admin/v3/family/care-notices', { params }) as unknown as Promise<{ items: FamilyCareNoticeItem[]; total: number }>;

// ============ 长辈模式 ============
export interface ElderUserItem {
  id: string;
  phone: string | null;
  email: string | null;
  nickname: string | null;
  elderModeEnabled: boolean;
  familyGroupId: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}

export const listElderUsers = (params: { page?: number; pageSize?: number; enabled?: boolean; keyword?: string }) =>
  request.get<{ items: ElderUserItem[]; total: number }>('/admin/v3/elder/users', { params }) as unknown as Promise<{ items: ElderUserItem[]; total: number }>;

export const toggleElderMode = (id: string, enabled: boolean) =>
  request.put<{ success: boolean; id: string; elderModeEnabled: boolean }>(`/admin/v3/elder/users/${id}/toggle`, { enabled }) as unknown as Promise<{ success: boolean; id: string; elderModeEnabled: boolean }>;

// ============ 深伪检测 ============
export interface DeepfakeCheckItem {
  id: string;
  userId: string;
  sourceType: string;
  fileDurationSec: number | null;
  resultScore: number | null;
  resultLabel: string | null;
  aiProvider: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  userFeedback: string | null;
}

export interface DeepfakeStats {
  total: number;
  today: number;
  byProvider: Array<{ provider: string; count: number }>;
  byLabel: Array<{ label: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

export const listDeepfakeChecks = (params: { page?: number; pageSize?: number; status?: string; label?: string }) =>
  request.get<{ items: DeepfakeCheckItem[]; total: number }>('/admin/v3/deepfake/checks', { params }) as unknown as Promise<{ items: DeepfakeCheckItem[]; total: number }>;

export const getDeepfakeStats = () =>
  request.get<DeepfakeStats>('/admin/v3/deepfake/stats') as unknown as Promise<DeepfakeStats>;

// ============ 暗网监控 ============
export interface BreachTargetItem {
  id: string;
  userId: string;
  targetType: string;
  targetValueHash: string;
  verified: boolean;
  lastScannedAt: string | null;
  createdAt: string;
  _count: { alerts: number };
}

export interface BreachAlertItem {
  id: string;
  targetId: string;
  userId: string;
  breachSource: string;
  breachName: string;
  breachDate: string | null;
  exposedData: string[];
  severity: string;
  dismissed: boolean;
  createdAt: string;
}

export const listBreachTargets = (params: { page?: number; pageSize?: number; verified?: boolean }) =>
  request.get<{ items: BreachTargetItem[]; total: number }>('/admin/v3/breach/targets', { params }) as unknown as Promise<{ items: BreachTargetItem[]; total: number }>;

export const listBreachAlerts = (params: { page?: number; pageSize?: number; severity?: string; dismissed?: boolean }) =>
  request.get<{ items: BreachAlertItem[]; total: number }>('/admin/v3/breach/alerts', { params }) as unknown as Promise<{ items: BreachAlertItem[]; total: number }>;
