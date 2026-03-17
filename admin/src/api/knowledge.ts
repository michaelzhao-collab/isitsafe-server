import request from './request';

export interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  source: string | null;
  language: string;
  createdAt: string;
}

export interface KnowledgeListRes {
  items: KnowledgeItem[];
  total: number;
  page?: number;
  pageSize?: number;
}

export function getKnowledge(params?: {
  page?: number;
  pageSize?: number;
  category?: string;
  search?: string;
  language?: string;
}) {
  const q: Record<string, string> = {};
  if (params?.page != null) q.page = String(params.page);
  if (params?.pageSize != null) q.pageSize = String(params.pageSize);
  if (params?.category) q.category = params.category;
  if (params?.search) q.search = params.search;
  if (params?.language) q.language = params.language;
  return request.get<KnowledgeListRes>('/admin/knowledge', { params: q });
}

export function createKnowledge(data: {
  title: string;
  category: string;
  content: string;
  tags?: string[];
  source?: string;
  language?: string;
}) {
  return request.post<KnowledgeItem>('/admin/knowledge/upload', data);
}

export function updateKnowledge(
  id: string,
  data: { title?: string; content?: string; category?: string; tags?: string[]; source?: string }
) {
  return request.put<KnowledgeItem>(`/admin/knowledge/${id}`, data);
}

export function deleteKnowledge(id: string) {
  return request.delete(`/admin/knowledge/${id}`);
}

export function bulkImportKnowledge(
  items: Array<{ title: string; category: string; content: string; language?: string }>,
  language?: string,
) {
  return request.post<{ created: number; ids?: string[] }>('/admin/knowledge/bulk-import', {
    items,
    language,
  });
}
