import request from './request';

export interface AiEvalSample {
  id: string;
  conversationId: string | null;
  userId: string | null;
  inputContent: string;
  inputType: string;
  language: string;
  promptSnapshot: { system: string; user: string };
  aiRawResponse: string;
  parsedResult: any;
  intent: string | null;
  intentVia: string | null;
  promptVersion: string;
  userSharedToFamily: boolean | null;
  userDismissed: boolean | null;
  adminScore: number | null;
  adminLabel: string | null;
  adminNotes: string | null;
  scoredByUserId: string | null;
  scoredAt: string | null;
  modelProvider: string;
  latencyMs: number;
  tokensUsed: number | null;
  createdAt: string;
}

export interface AiEvalListResp {
  items: AiEvalSample[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AiEvalVersionStat {
  promptVersion: string;
  total: number;
  scored: number;
  avgScore: number | null;
}

export const listAiEvalSamples = (params: {
  promptVersion?: string;
  intent?: string;
  scored?: 'yes' | 'no' | 'all';
  page?: number;
  pageSize?: number;
}) => {
  const q: string[] = [];
  if (params.promptVersion) q.push(`promptVersion=${encodeURIComponent(params.promptVersion)}`);
  if (params.intent) q.push(`intent=${encodeURIComponent(params.intent)}`);
  if (params.scored) q.push(`scored=${params.scored}`);
  if (params.page) q.push(`page=${params.page}`);
  if (params.pageSize) q.push(`pageSize=${params.pageSize}`);
  return request.get<AiEvalListResp>(`/admin/ai-evaluation/samples?${q.join('&')}`) as unknown as Promise<AiEvalListResp>;
};

export const getAiEvalSample = (id: string) =>
  request.get<AiEvalSample>(`/admin/ai-evaluation/samples/${id}`) as unknown as Promise<AiEvalSample>;

export const scoreAiEvalSample = (
  id: string,
  body: { score: number; label?: string; notes?: string },
) =>
  request.put<AiEvalSample>(`/admin/ai-evaluation/samples/${id}/score`, body) as unknown as Promise<AiEvalSample>;

export const getAiEvalStats = () =>
  request.get<AiEvalVersionStat[]>(`/admin/ai-evaluation/stats`) as unknown as Promise<AiEvalVersionStat[]>;
