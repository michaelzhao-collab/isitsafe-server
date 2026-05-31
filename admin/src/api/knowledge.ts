import request from './request';

export interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  /** TipTap JSON（type/content/attrs）；为 null 表示旧版纯文本案例 */
  contentBlocks?: unknown | null;
  /** 封面图 R2 URL */
  coverImage?: string | null;
  tags: string[];
  source: string | null;
  language: string;
  /** 'published' | 'draft' | 'archived' */
  status?: string;
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
  status?: string;
}) {
  const q: Record<string, string> = {};
  if (params?.page != null) q.page = String(params.page);
  if (params?.pageSize != null) q.pageSize = String(params.pageSize);
  if (params?.category) q.category = params.category;
  if (params?.search) q.search = params.search;
  if (params?.language) q.language = params.language;
  if (params?.status) q.status = params.status;
  return request.get<KnowledgeListRes>('/admin/knowledge', { params: q });
}

export function createKnowledge(data: {
  title: string;
  category: string;
  content: string;
  tags?: string[];
  source?: string;
  language?: string;
  contentBlocks?: unknown | null;
  coverImage?: string | null;
}) {
  return request.post<KnowledgeItem>('/admin/knowledge/upload', data);
}

export function updateKnowledge(
  id: string,
  data: {
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    source?: string;
    contentBlocks?: unknown | null;
    coverImage?: string | null;
    status?: string;
  }
) {
  return request.put<KnowledgeItem>(`/admin/knowledge/${id}`, data);
}

/**
 * 上传图片到 R2（通过统一 /upload/file 接口；admin 与 iOS 共用同一接口）
 * type 用 'article' 区分文章正文图片；返回 CDN URL 直接可嵌入 TipTap
 */
export async function uploadArticleImage(file: File, type: 'article' | 'case' | 'knowledge' = 'article'): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('type', type);
  const res = await request.post<{ url: string }>('/upload/file', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return (res as any).url;
}

export function deleteKnowledge(id: string) {
  return request.delete(`/admin/knowledge/${id}`);
}

export function bulkImportKnowledge(
  items: Array<{ title: string; category: string; content: string; language?: string }>,
  language?: string,
) {
  return request.post<{ created: number; ids?: string[]; unknownCategories?: string[]; skippedByTitle?: number }>('/admin/knowledge/bulk-import', {
    items,
    language,
  });
}

export function bulkDeleteKnowledge(ids: string[]) {
  return request.post<{ deleted: number }>('/admin/knowledge/bulk-delete', { ids });
}
