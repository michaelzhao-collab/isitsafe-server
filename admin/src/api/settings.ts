import request from './request';

export interface SystemSettingsRes {
  defaultProvider?: string;
  hasDoubaoKey?: boolean;
  hasOpenaiKey?: boolean;
  aiBaseUrl?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export function getSettings() {
  return request.get<SystemSettingsRes>('/admin/settings');
}

export function updateSettings(body: {
  defaultProvider?: string;
  doubaoKey?: string | null;
  openaiKey?: string | null;
  aiBaseUrl?: string | null;
  [key: string]: unknown;
}) {
  return request.put<SystemSettingsRes>('/admin/settings', body);
}
