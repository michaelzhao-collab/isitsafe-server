import request from './request';

export interface OnboardingChip {
  id: string;
  orderIdx: number;
  labelZh: string;
  labelEn: string;
  iconType: string;
  actionType: string;
  actionPayloadZh: string | null;
  actionPayloadEn: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingChipUpsert {
  orderIdx?: number;
  labelZh: string;
  labelEn: string;
  iconType?: string;
  actionType: string;
  actionPayloadZh?: string | null;
  actionPayloadEn?: string | null;
  status?: 'active' | 'archived';
}

export const listOnboardingChips = (status?: string) => {
  const q = status ? `?status=${status}` : '';
  return request.get<OnboardingChip[]>(`/admin/onboarding/chips${q}`) as unknown as Promise<OnboardingChip[]>;
};

export const createOnboardingChip = (body: OnboardingChipUpsert) =>
  request.post<OnboardingChip>('/admin/onboarding/chips', body) as unknown as Promise<OnboardingChip>;

export const updateOnboardingChip = (id: string, body: Partial<OnboardingChipUpsert>) =>
  request.put<OnboardingChip>(`/admin/onboarding/chips/${id}`, body) as unknown as Promise<OnboardingChip>;

export const deleteOnboardingChip = (id: string) =>
  request.delete(`/admin/onboarding/chips/${id}`);
