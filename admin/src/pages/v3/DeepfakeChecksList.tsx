import { useEffect, useState } from 'react';
import { Table, Card, Button, Space, message, Tag, Tooltip, Select, Statistic, Row, Col } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { listDeepfakeChecks, getDeepfakeStats, type DeepfakeCheckItem, type DeepfakeStats } from '../../api/v3Admin';

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'processing', label: '处理中' },
  { value: 'done', label: '已完成' },
  { value: 'failed', label: '失败' },
];

const LABEL_OPTIONS = [
  { value: 'all', label: '全部结果' },
  { value: 'high', label: '高危' },
  { value: 'medium', label: '可疑' },
  { value: 'low', label: '真人' },
];

export default function DeepfakeChecksList() {
  const [data, setData] = useState<{ items: DeepfakeCheckItem[]; total: number }>({ items: [], total: 0 });
  const [stats, setStats] = useState<DeepfakeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState('all');
  const [label, setLabel] = useState('all');

  const load = () => {
    setLoading(true);
    Promise.all([
      listDeepfakeChecks({
        page, pageSize,
        status: status === 'all' ? undefined : status,
        label: label === 'all' ? undefined : label,
      }),
      getDeepfakeStats(),
    ])
      .then(([list, s]) => { setData(list); setStats(s); })
      .catch((e: any) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize, status, label]);

  const cols = [
    { title: '任务ID', dataIndex: 'id', key: 'id', width: 130, ellipsis: true },
    { title: '用户', dataIndex: 'userId', key: 'userId', width: 140, render: (v: string) => <Tooltip title={v}><Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.slice(0, 10)}…</Tag></Tooltip> },
    { title: '来源', dataIndex: 'sourceType', key: 'sourceType', width: 90, render: (v: string) => <Tag>{v === 'record' ? '录音' : v === 'upload' ? '上传' : v === 'share' ? '分享' : v}</Tag> },
    { title: '时长', dataIndex: 'fileDurationSec', key: 'fileDurationSec', width: 80, render: (v: number | null) => v ? `${v}s` : '—' },
    {
      title: '评分',
      dataIndex: 'resultScore',
      key: 'resultScore',
      width: 90,
      render: (v: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : '—',
    },
    {
      title: '结果',
      dataIndex: 'resultLabel',
      key: 'resultLabel',
      width: 90,
      render: (v: string | null) => v
        ? <Tag color={v === 'high' ? 'red' : v === 'medium' ? 'orange' : 'green'}>{v === 'high' ? '高危' : v === 'medium' ? '可疑' : '真人'}</Tag>
        : '—',
    },
    { title: 'Provider', dataIndex: 'aiProvider', key: 'aiProvider', width: 130, render: (v: string | null) => v || <Tag>—</Tag> },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => <Tag color={v === 'done' ? 'green' : v === 'failed' ? 'red' : 'blue'}>{v}</Tag>,
    },
    {
      title: '用户反馈', dataIndex: 'userFeedback', key: 'userFeedback', width: 100,
      render: (v: string | null) => v ? <Tag color={v === 'accurate' ? 'green' : 'orange'}>{v === 'accurate' ? '准确' : '不准'}</Tag> : '—'
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1F2D3D' }}>语音深伪检测（V3-A1）</h2>

      {stats && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={4}><Statistic title="总检测数" value={stats.total} /></Col>
            <Col span={4}><Statistic title="今日新增" value={stats.today} valueStyle={{ color: '#3f8600' }} /></Col>
            <Col span={8}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>按 Provider</div>
              <Space wrap>
                {stats.byProvider.map((p) => <Tag key={p.provider}>{p.provider}: {p.count}</Tag>)}
              </Space>
            </Col>
            <Col span={8}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>按结果分布</div>
              <Space wrap>
                {stats.byLabel.map((l) => <Tag key={l.label} color={l.label === 'high' ? 'red' : l.label === 'medium' ? 'orange' : l.label === 'low' ? 'green' : 'default'}>{l.label}: {l.count}</Tag>)}
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      <Card extra={
        <Space>
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} style={{ width: 140 }} />
          <Select value={label} onChange={setLabel} options={LABEL_OPTIONS} style={{ width: 140 }} />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      }>
        <Table
          rowKey="id" loading={loading} columns={cols} dataSource={data.items} scroll={{ x: 1300 }}
          pagination={{
            current: page, pageSize, total: data.total, showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps || 20); },
          }}
        />
      </Card>
    </div>
  );
}
