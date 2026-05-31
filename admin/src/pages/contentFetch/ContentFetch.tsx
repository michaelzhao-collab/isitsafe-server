/**
 * V3-K 内容抓取页
 * 两个按钮：抓 10 天情报 / 抓 10 天案例
 * - 点击后立即返回 jobId，前端轮询 GET /jobs/:id 看进度
 * - 同时刷新最近 5 次 job 列表
 * - 24h 内同 type 上限 3 次（服务端兜底报错）
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Space, Table, Tag, message, Tooltip, Divider, Empty } from 'antd';
import { ReloadOutlined, ThunderboltOutlined, BookOutlined } from '@ant-design/icons';
import {
  triggerContentFetch,
  listContentFetchJobs,
  getContentFetchJob,
  type ContentFetchJob,
  type ContentFetchType,
} from '../../api/contentFetch';

const POLL_INTERVAL_MS = 3000;

const STATUS_TAGS: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '等待中' },
  running: { color: 'processing', label: '执行中' },
  done: { color: 'success', label: '完成' },
  failed: { color: 'error', label: '失败' },
};

const TYPE_LABEL: Record<ContentFetchType, string> = {
  intel: '情报',
  knowledge: '案例',
};

export default function ContentFetchPage() {
  const [jobs, setJobs] = useState<ContentFetchJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState<Record<ContentFetchType, boolean>>({
    intel: false,
    knowledge: false,
  });
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listContentFetchJobs({ limit: 10 });
      setJobs(list);
      // 找当前 running 的 job
      const running = list.find((j) => j.status === 'running' || j.status === 'pending');
      if (running) {
        setPollingJobId(running.id);
      } else if (pollingJobId) {
        setPollingJobId(null);
      }
    } catch (e: any) {
      message.error(e?.message ?? '加载 jobs 失败');
    } finally {
      setLoading(false);
    }
  }, [pollingJobId]);

  // 首次加载
  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 轮询：当有 running job 时每 3s 拉一次
  useEffect(() => {
    if (!pollingJobId) return;
    const timer = setInterval(async () => {
      try {
        const j = await getContentFetchJob(pollingJobId);
        setJobs((old) => old.map((x) => (x.id === j.id ? j : x)));
        if (j.status === 'done' || j.status === 'failed') {
          setPollingJobId(null);
          loadJobs();
        }
      } catch (e: any) {
        // 静默：可能 job 已被删；停止轮询
        setPollingJobId(null);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pollingJobId, loadJobs]);

  const handleTrigger = async (type: ContentFetchType) => {
    setTriggering((t) => ({ ...t, [type]: true }));
    try {
      const { jobId } = await triggerContentFetch(type);
      message.success(`${TYPE_LABEL[type]}抓取已启动，jobId=${jobId.slice(0, 8)}`);
      setPollingJobId(jobId);
      await loadJobs();
    } catch (e: any) {
      message.error(e?.message ?? '触发失败');
    } finally {
      setTriggering((t) => ({ ...t, [type]: false }));
    }
  };

  const isRunning = (type: ContentFetchType) =>
    jobs.some((j) => j.type === type && (j.status === 'pending' || j.status === 'running'));

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (t: ContentFetchType) => <Tag color={t === 'intel' ? 'blue' : 'green'}>{TYPE_LABEL[t]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const t = STATUS_TAGS[s] ?? STATUS_TAGS.pending;
        return <Tag color={t.color}>{t.label}</Tag>;
      },
    },
    {
      title: '发现',
      dataIndex: 'totalFound',
      key: 'totalFound',
      width: 70,
      align: 'right' as const,
    },
    {
      title: '入库',
      dataIndex: 'totalInserted',
      key: 'totalInserted',
      width: 70,
      align: 'right' as const,
      render: (v: number) => <span style={{ color: v > 0 ? '#52c41a' : undefined }}>{v}</span>,
    },
    {
      title: '失败',
      dataIndex: 'totalFailed',
      key: 'totalFailed',
      width: 70,
      align: 'right' as const,
      render: (v: number) => <span style={{ color: v > 0 ? '#cf1322' : undefined }}>{v}</span>,
    },
    {
      title: '触发时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (s: string) => new Date(s).toLocaleString(),
    },
    {
      title: '耗时',
      key: 'duration',
      width: 80,
      render: (_: unknown, r: ContentFetchJob) => {
        if (!r.startedAt) return '-';
        const start = new Date(r.startedAt).getTime();
        const end = r.finishedAt ? new Date(r.finishedAt).getTime() : Date.now();
        return `${Math.round((end - start) / 1000)}s`;
      },
    },
    {
      title: '错误',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      ellipsis: true,
      render: (e: string | null) =>
        e ? <Tooltip title={e}><span style={{ color: '#cf1322' }}>{e.slice(0, 50)}...</span></Tooltip> : '-',
    },
  ];

  const expandedRowRender = (record: ContentFetchJob) => {
    const items = record.resultJson?.items ?? [];
    const sources = record.resultJson?.sources ?? [];

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 各源诊断（为什么 0 条往这里看） */}
        {sources.length > 0 && (
          <div>
            <div style={{ marginBottom: 6, color: '#666', fontSize: 13 }}>各源抓取状态</div>
            <Table
              size="small"
              rowKey={(r) => r.sourceKey}
              dataSource={sources}
              pagination={false}
              columns={[
                { title: '源', dataIndex: 'sourceName', key: 'sourceName', width: 220 },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 80,
                  render: (s: string) => {
                    if (s === 'ok') return <Tag color="success">ok</Tag>;
                    if (s === 'empty') return <Tag color="warning">空（0 条）</Tag>;
                    return <Tag color="error">失败</Tag>;
                  },
                },
                { title: '抓到', dataIndex: 'found', key: 'found', width: 70, align: 'right' as const },
                {
                  title: '耗时',
                  dataIndex: 'tookMs',
                  key: 'tookMs',
                  width: 70,
                  align: 'right' as const,
                  render: (n: number) => `${n}ms`,
                },
                {
                  title: '错误',
                  dataIndex: 'error',
                  key: 'error',
                  ellipsis: true,
                  render: (e: string | undefined) =>
                    e ? <Tooltip title={e}><span style={{ color: '#cf1322' }}>{e.slice(0, 80)}</span></Tooltip> : '-',
                },
              ]}
            />
          </div>
        )}

        {/* 候选条目处理结果 */}
        {items.length > 0 && (
          <div>
            <div style={{ marginBottom: 6, color: '#666', fontSize: 13 }}>候选条目处理结果</div>
            <Table
              size="small"
              rowKey={(r) => r.sourceUrl + r.title}
              dataSource={items}
              pagination={false}
              columns={[
                { title: '源', dataIndex: 'source', key: 'source', width: 180 },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 80,
                  render: (s) =>
                    s === 'inserted' ? <Tag color="success">入库</Tag> : <Tag color="error">失败</Tag>,
                },
                { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
                {
                  title: '原链接',
                  dataIndex: 'sourceUrl',
                  key: 'sourceUrl',
                  width: 250,
                  render: (u: string) => (
                    <a href={u} target="_blank" rel="noopener noreferrer">
                      {u.slice(0, 50)}...
                    </a>
                  ),
                },
                { title: '错误', dataIndex: 'errorMessage', key: 'errorMessage', ellipsis: true },
              ]}
            />
          </div>
        )}

        {sources.length === 0 && items.length === 0 && <Empty description="暂无明细" />}
      </Space>
    );
  };

  return (
    <div>
      <Card title="AI 内容抓取" extra={<Button icon={<ReloadOutlined />} onClick={loadJobs} loading={loading}>刷新</Button>}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Space size="large">
              <Button
                type="primary"
                size="large"
                icon={<ThunderboltOutlined />}
                loading={triggering.intel}
                disabled={isRunning('intel')}
                onClick={() => handleTrigger('intel')}
              >
                抓 10 天反诈情报
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<BookOutlined />}
                loading={triggering.knowledge}
                disabled={isRunning('knowledge')}
                onClick={() => handleTrigger('knowledge')}
              >
                抓 10 天反诈案例
              </Button>
            </Space>
            <div style={{ marginTop: 12, color: '#888', fontSize: 13 }}>
              点击后从权威源（FTC / IC3 / BBB / ScamWatch / 中国警察网等）抓取，AI 改写为中英双语后入库。
              <br />
              入库状态为 <Tag>draft</Tag>，需要在 情报管理 / 案例库管理 中手动审核 + 上架。
              <br />
              限流：同类型 24h 内最多 3 次；当前执行中按钮禁用。
            </div>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div>
            <h3>最近抓取记录</h3>
            <Table
              rowKey="id"
              loading={loading}
              dataSource={jobs}
              columns={columns}
              pagination={false}
              size="middle"
              expandable={{ expandedRowRender }}
            />
          </div>
        </Space>
      </Card>
    </div>
  );
}
