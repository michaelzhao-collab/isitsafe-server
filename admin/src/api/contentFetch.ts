import request from './request';

export type ContentFetchType = 'intel' | 'knowledge';
export type ContentFetchStatus = 'pending' | 'running' | 'done' | 'failed';

export interface ContentFetchJob {
  id: string;
  type: ContentFetchType;
  status: ContentFetchStatus;
  triggeredBy: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  totalFound: number;
  totalInserted: number;
  totalDuplicated: number;
  totalFailed: number;
  errorMessage?: string | null;
  resultJson?: {
    items?: Array<{
      source: string;
      title: string;
      sourceUrl: string;
      status: 'inserted' | 'failed';
      errorMessage?: string;
    }>;
    sources?: Array<{
      sourceKey: string;
      sourceName: string;
      status: 'ok' | 'empty' | 'failed';
      found: number;
      tookMs: number;
      error?: string;
    }>;
  } | null;
  createdAt: string;
}

export const triggerContentFetch = (type: ContentFetchType) =>
  request.post<{ jobId: string }>(`/admin/content-fetch/trigger?type=${type}`) as unknown as Promise<{
    jobId: string;
  }>;

export const listContentFetchJobs = (params: { type?: ContentFetchType; limit?: number } = {}) => {
  const q: string[] = [];
  if (params.type) q.push(`type=${params.type}`);
  if (params.limit) q.push(`limit=${params.limit}`);
  return request.get<ContentFetchJob[]>(`/admin/content-fetch/jobs?${q.join('&')}`) as unknown as Promise<
    ContentFetchJob[]
  >;
};

export const getContentFetchJob = (id: string) =>
  request.get<ContentFetchJob>(`/admin/content-fetch/jobs/${id}`) as unknown as Promise<ContentFetchJob>;
