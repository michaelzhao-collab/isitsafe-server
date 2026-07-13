import request from './request';

export type ModerationType = 'report' | 'block';
export type ModerationStatus = 'pending' | 'reviewed' | 'actioned';

export interface ModerationItem {
  id: string;
  type: ModerationType;
  status: ModerationStatus;
  reason?: string | null;
  reporterId: string;
  reporterName?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  messageId?: string | null;
  messageType?: string | null;
  messageContent?: string | null;
  messageRecalled?: boolean;
  createdAt: string;
}

export interface ModerationListResponse {
  items: ModerationItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ModerationStats {
  pending: number;
  reviewed: number;
  actioned: number;
  total: number;
}

// 响应拦截器已 unwrap res.data，但 axios 类型仍是 AxiosResponse<T>，故在此统一 cast 为 Promise<T>
export function listModerations(params: {
  type?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<ModerationListResponse> {
  return request.get('/admin/im-moderations', {
    params: {
      ...(params.type && { type: params.type }),
      ...(params.status && { status: params.status }),
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 30,
    },
  }) as unknown as Promise<ModerationListResponse>;
}

export function moderationStats(): Promise<ModerationStats> {
  return request.get('/admin/im-moderations/stats') as unknown as Promise<ModerationStats>;
}

export function updateModerationStatus(id: string, status: ModerationStatus): Promise<void> {
  return request.put(`/admin/im-moderations/${id}/status`, { status }) as unknown as Promise<void>;
}
