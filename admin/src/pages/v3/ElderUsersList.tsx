import { useEffect, useState } from 'react';
import { Table, Card, Input, Button, Space, message, Tag, Switch, Tooltip, Select, Popconfirm } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { listElderUsers, toggleElderMode, type ElderUserItem } from '../../api/v3Admin';

const FILTER_OPTIONS = [
  { value: 'all', label: '全部用户' },
  { value: 'true', label: '已开启长辈模式' },
  { value: 'false', label: '未开启' },
];

export default function ElderUsersList() {
  const [data, setData] = useState<{ items: ElderUserItem[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [enabled, setEnabled] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    listElderUsers({
      page, pageSize,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      keyword: keyword.trim() || undefined,
    })
      .then(setData)
      .catch((e: any) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize, enabled]);

  const onToggle = async (id: string, next: boolean) => {
    setToggling((s) => new Set(s).add(id));
    try {
      await toggleElderMode(id, next);
      message.success(next ? '已开启长辈模式' : '已关闭长辈模式');
      // 乐观更新：局部刷新 state，避免整页 loading
      setData((d) => ({ ...d, items: d.items.map((u) => u.id === id ? { ...u, elderModeEnabled: next } : u) }));
    } catch (e: any) {
      message.error(e?.message ?? '切换失败');
    } finally {
      setToggling((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const cols = [
    {
      title: '用户',
      key: 'user',
      width: 240,
      render: (_: unknown, row: ElderUserItem) => (
        <Space direction="vertical" size={2}>
          <span>{row.nickname || row.phone || row.email || '—'}</span>
          <Tooltip title={row.id}><Tag style={{ fontSize: 11, fontFamily: 'monospace' }}>{row.id.slice(0, 10)}…</Tag></Tooltip>
        </Space>
      ),
    },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140, render: (v: string | null) => v || '—' },
    {
      title: '长辈模式',
      dataIndex: 'elderModeEnabled',
      key: 'elderModeEnabled',
      width: 110,
      render: (_: boolean, row: ElderUserItem) => (
        <Popconfirm
          title={row.elderModeEnabled ? `确认关闭 "${row.nickname || row.phone}" 的长辈模式？` : `为 "${row.nickname || row.phone}" 开启长辈模式？`}
          onConfirm={() => onToggle(row.id, !row.elderModeEnabled)}
          okText="确认" cancelText="取消"
        >
          <Switch checked={row.elderModeEnabled} loading={toggling.has(row.id)} />
        </Popconfirm>
      ),
    },
    {
      title: '家庭组',
      dataIndex: 'familyGroupId',
      key: 'familyGroupId',
      width: 140,
      render: (v: string | null) => v
        ? <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.slice(0, 10)}…</Tag>
        : <Tag>未加入</Tag>,
    },
    {
      title: '最后活跃',
      dataIndex: 'lastActiveAt',
      key: 'lastActiveAt',
      width: 160,
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1F2D3D' }}>长辈模式（V3-J）</h2>
      <Card extra={
        <Space>
          <Input placeholder="手机号/邮箱/昵称" value={keyword} onChange={(e) => setKeyword(e.target.value)} onPressEnter={() => { setPage(1); load(); }} allowClear style={{ width: 220 }} />
          <Select value={enabled} onChange={setEnabled} options={FILTER_OPTIONS} style={{ width: 160 }} />
          <Button type="primary" onClick={() => { setPage(1); load(); }}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      }>
        <Table
          rowKey="id" loading={loading} columns={cols} dataSource={data.items} scroll={{ x: 1000 }}
          pagination={{
            current: page, pageSize, total: data.total, showSizeChanger: true,
            showTotal: (t) => `共 ${t} 个用户`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps || 20); },
          }}
        />
      </Card>
    </div>
  );
}
