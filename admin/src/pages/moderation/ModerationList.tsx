import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Select, message, Popconfirm, Drawer, Statistic, Row, Col } from 'antd';
import dayjs from 'dayjs';
import {
  listModerations,
  moderationStats,
  updateModerationStatus,
  type ModerationItem,
  type ModerationStats,
} from '../../api/moderation';

/**
 * 2026-09-07 复核：原来直接 `v.slice(0,19).replace('T',' ')` 截 ISO 字符串，
 * 那是 UTC 时间，运营看到的比北京时间早 8 小时。改成按浏览器本地时区渲染。
 */
const fmtLocal = (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '');

const STATUS_COLORS: Record<string, string> = {
  pending: 'gold',
  reviewed: 'blue',
  actioned: 'green',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  reviewed: '已查看',
  actioned: '已处置',
};
const TYPE_LABEL: Record<string, string> = { report: '举报', block: '拉黑' };

export default function ModerationList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: ModerationItem[]; total: number }>({ items: [], total: 0 });
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [type, setType] = useState<string | undefined>('report');
  const [status, setStatus] = useState<string | undefined>('pending');
  const [previewRow, setPreviewRow] = useState<ModerationItem | null>(null);

  const load = () => {
    setLoading(true);
    listModerations({ type, status, page, pageSize })
      .then((r) => setData({ items: r.items, total: r.total }))
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
    moderationStats().then(setStats).catch(() => undefined);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, type, status]);

  const setStatusAction = (id: string, s: 'reviewed' | 'actioned') => {
    updateModerationStatus(id, s)
      .then(() => {
        message.success('已更新');
        load();
      })
      .catch((e) => message.error(e?.message ?? '操作失败'));
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (t: string) => <Tag color={t === 'report' ? 'red' : 'volcano'}>{TYPE_LABEL[t] ?? t}</Tag>,
    },
    {
      title: '举报人',
      dataIndex: 'reporterName',
      key: 'reporterName',
      width: 140,
      render: (v: string | null, row: ModerationItem) => v || row.reporterId?.slice(0, 8) || '-',
    },
    {
      title: '被举报内容',
      dataIndex: 'messageContent',
      key: 'messageContent',
      ellipsis: true,
      render: (v: string | null, row: ModerationItem) => {
        if (row.type === 'block') return <span style={{ color: '#999' }}>屏蔽 {row.targetName || row.targetId?.slice(0, 8)}</span>;
        if (row.messageRecalled) return <span style={{ color: '#999' }}>（消息已撤回）</span>;
        if (!v) return <span style={{ color: '#999' }}>[{row.messageType || '非文本'}]</span>;
        return v.length > 50 ? v.slice(0, 50) + '...' : v;
      },
    },
    { title: '家庭', dataIndex: 'groupName', key: 'groupName', width: 120, render: (v: string | null) => v ?? '-' },
    {
      title: '理由',
      dataIndex: 'reason',
      key: 'reason',
      width: 140,
      ellipsis: true,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{STATUS_LABEL[s] ?? s}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => fmtLocal(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right' as const,
      render: (_: unknown, row: ModerationItem) => (
        <Space>
          <Button type="link" size="small" onClick={() => setPreviewRow(row)}>
            查看
          </Button>
          {row.status === 'pending' && (
            <Button type="link" size="small" onClick={() => setStatusAction(row.id, 'reviewed')}>
              标记已查看
            </Button>
          )}
          {row.status !== 'actioned' && (
            <Popconfirm title="标记为已处置？（表示已按合规流程处理）" onConfirm={() => setStatusAction(row.id, 'actioned')}>
              <Button type="link" size="small" style={{ color: '#16a34a' }}>
                已处置
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1F2D3D' }}>家庭群举报 / 拉黑</h2>
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card size="small"><Statistic title="待处理" value={stats.pending} valueStyle={{ color: '#d48806' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="已查看" value={stats.reviewed} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="已处置" value={stats.actioned} valueStyle={{ color: '#16a34a' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="举报总数" value={stats.total} /></Card></Col>
        </Row>
      )}
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 140 }}
            value={type}
            onChange={(v) => { setType(v); setPage(1); }}
            allowClear
            placeholder="类型"
            options={[
              { label: '举报', value: 'report' },
              { label: '拉黑', value: 'block' },
            ]}
          />
          <Select
            style={{ width: 160 }}
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            allowClear
            placeholder="状态筛选"
            options={[
              { label: '待处理 pending', value: 'pending' },
              { label: '已查看 reviewed', value: 'reviewed' },
              { label: '已处置 actioned', value: 'actioned' },
            ]}
          />
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data.items}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              if (ps) setPageSize(ps);
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
      <Drawer open={!!previewRow} onClose={() => setPreviewRow(null)} title="举报详情" width={520}>
        {previewRow && (
          <div style={{ lineHeight: 1.9 }}>
            <div><strong>类型：</strong>{TYPE_LABEL[previewRow.type] ?? previewRow.type}</div>
            <div><strong>举报人：</strong>{previewRow.reporterName || previewRow.reporterId}</div>
            {previewRow.targetId && <div><strong>被处置人：</strong>{previewRow.targetName || previewRow.targetId}</div>}
            <div><strong>家庭：</strong>{previewRow.groupName ?? '-'}</div>
            <div><strong>时间：</strong>{fmtLocal(previewRow.createdAt)}</div>
            <div><strong>状态：</strong><Tag color={STATUS_COLORS[previewRow.status] ?? 'default'}>{STATUS_LABEL[previewRow.status] ?? previewRow.status}</Tag></div>
            {previewRow.reason && <div><strong>理由：</strong>{previewRow.reason}</div>}
            {previewRow.type === 'report' && (
              <div style={{ marginTop: 16, padding: 12, background: '#F2F6FB', borderRadius: 6 }}>
                <strong>被举报消息：</strong>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
                  {previewRow.messageRecalled
                    ? '（消息已被撤回，无内容）'
                    : previewRow.messageContent || `[${previewRow.messageType || '非文本消息'}]`}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
