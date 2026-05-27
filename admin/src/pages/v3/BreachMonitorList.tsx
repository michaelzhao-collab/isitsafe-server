import { useEffect, useState } from 'react';
import { Table, Card, Button, Space, message, Tag, Tooltip, Select, Tabs } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { listBreachTargets, listBreachAlerts, type BreachTargetItem, type BreachAlertItem } from '../../api/v3Admin';

function TargetsTab() {
  const [data, setData] = useState<{ items: BreachTargetItem[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [verified, setVerified] = useState<string>('all');

  const load = () => {
    setLoading(true);
    listBreachTargets({
      page, pageSize,
      verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
    })
      .then(setData)
      .catch((e: any) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize, verified]);

  const cols = [
    { title: '目标ID', dataIndex: 'id', key: 'id', width: 130, ellipsis: true },
    { title: '用户', dataIndex: 'userId', key: 'userId', width: 140, render: (v: string) => <Tooltip title={v}><Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.slice(0, 10)}…</Tag></Tooltip> },
    { title: '类型', dataIndex: 'targetType', key: 'targetType', width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: '目标（脱敏）', dataIndex: 'targetValueHash', key: 'targetValueHash', width: 200 },
    { title: '验证状态', dataIndex: 'verified', key: 'verified', width: 100, render: (v: boolean) => v ? <Tag color="green">已验证</Tag> : <Tag color="orange">未验证</Tag> },
    { title: '告警数', dataIndex: ['_count', 'alerts'], key: 'alerts', width: 80 },
    { title: '最后扫描', dataIndex: 'lastScannedAt', key: 'lastScannedAt', width: 160, render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
  ];

  return (
    <Card extra={
      <Space>
        <Select value={verified} onChange={setVerified} options={[
          { value: 'all', label: '全部' },
          { value: 'true', label: '已验证' },
          { value: 'false', label: '未验证' },
        ]} style={{ width: 140 }} />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>
    }>
      <Table
        rowKey="id" loading={loading} columns={cols} dataSource={data.items} scroll={{ x: 1100 }}
        pagination={{
          current: page, pageSize, total: data.total, showSizeChanger: true,
          showTotal: (t) => `共 ${t} 个监控目标`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps || 20); },
        }}
      />
    </Card>
  );
}

function AlertsTab() {
  const [data, setData] = useState<{ items: BreachAlertItem[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [severity, setSeverity] = useState<string>('all');
  const [dismissed, setDismissed] = useState<string>('all');

  const load = () => {
    setLoading(true);
    listBreachAlerts({
      page, pageSize,
      severity: severity === 'all' ? undefined : severity,
      dismissed: dismissed === 'true' ? true : dismissed === 'false' ? false : undefined,
    })
      .then(setData)
      .catch((e: any) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize, severity, dismissed]);

  const cols = [
    { title: '告警ID', dataIndex: 'id', key: 'id', width: 130, ellipsis: true },
    { title: '用户', dataIndex: 'userId', key: 'userId', width: 140, render: (v: string) => <Tooltip title={v}><Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.slice(0, 10)}…</Tag></Tooltip> },
    { title: '泄露来源', dataIndex: 'breachSource', key: 'breachSource', width: 120, render: (v: string) => <Tag color={v === 'HIBP_stub' ? 'default' : 'blue'}>{v}</Tag> },
    { title: '泄露事件', dataIndex: 'breachName', key: 'breachName', width: 180, ellipsis: true },
    { title: '泄露日期', dataIndex: 'breachDate', key: 'breachDate', width: 120, render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD') : '—' },
    {
      title: '严重度', dataIndex: 'severity', key: 'severity', width: 90,
      render: (v: string) => <Tag color={v === 'high' ? 'red' : v === 'medium' ? 'orange' : 'green'}>{v}</Tag>,
    },
    {
      title: '泄露字段', dataIndex: 'exposedData', key: 'exposedData', ellipsis: true,
      render: (v: string[]) => <Space wrap size={4}>{(v ?? []).map((d) => <Tag key={d}>{d}</Tag>)}</Space>,
    },
    { title: '用户已忽略', dataIndex: 'dismissed', key: 'dismissed', width: 100, render: (v: boolean) => v ? <Tag>已忽略</Tag> : <Tag color="processing">活跃</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
  ];

  return (
    <Card extra={
      <Space>
        <Select value={severity} onChange={setSeverity} options={[
          { value: 'all', label: '全部严重度' },
          { value: 'high', label: '高' },
          { value: 'medium', label: '中' },
          { value: 'low', label: '低' },
        ]} style={{ width: 140 }} />
        <Select value={dismissed} onChange={setDismissed} options={[
          { value: 'all', label: '全部状态' },
          { value: 'false', label: '未忽略' },
          { value: 'true', label: '已忽略' },
        ]} style={{ width: 140 }} />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>
    }>
      <Table
        rowKey="id" loading={loading} columns={cols} dataSource={data.items} scroll={{ x: 1300 }}
        pagination={{
          current: page, pageSize, total: data.total, showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条告警`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps || 20); },
        }}
      />
    </Card>
  );
}

export default function BreachMonitorList() {
  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1F2D3D' }}>暗网监控（V3-F）</h2>
      <Tabs
        defaultActiveKey="targets"
        items={[
          { key: 'targets', label: '监控目标', children: <TargetsTab /> },
          { key: 'alerts', label: '泄露告警', children: <AlertsTab /> },
        ]}
      />
    </div>
  );
}
