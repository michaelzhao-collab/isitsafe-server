import { useEffect, useState } from 'react';
import { Table, Card, Input, Button, Space, message, Tag, Tabs, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  listFamilyGroups,
  listFamilyBroadcasts,
  listFamilyCareNotices,
  type FamilyGroupItem,
  type FamilyBroadcastItem,
  type FamilyCareNoticeItem,
} from '../../api/v3Admin';

function GroupsTab() {
  const [data, setData] = useState<{ items: FamilyGroupItem[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');

  const load = () => {
    setLoading(true);
    listFamilyGroups({ page, pageSize, keyword: keyword.trim() || undefined })
      .then(setData)
      .catch((e: any) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize]);

  const cols = [
    { title: '群名', dataIndex: 'name', key: 'name', width: 180 },
    { title: '邀请码', dataIndex: 'inviteCode', key: 'inviteCode', width: 110, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '群主',
      key: 'owner',
      width: 180,
      render: (_: unknown, row: FamilyGroupItem) => (
        <Space direction="vertical" size={2}>
          <span>{row.owner?.nickname || row.owner?.phone || '—'}</span>
          <Tooltip title={row.ownerUserId}><Tag style={{ fontSize: 11, fontFamily: 'monospace' }}>{row.ownerUserId.slice(0, 10)}…</Tag></Tooltip>
        </Space>
      ),
    },
    { title: '成员数', dataIndex: ['_count', 'members'], key: 'members', width: 80 },
    { title: '广播数', dataIndex: ['_count', 'broadcasts'], key: 'broadcasts', width: 80 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
  ];

  return (
    <Card extra={
      <Space>
        <Input placeholder="群名/邀请码" value={keyword} onChange={(e) => setKeyword(e.target.value)} onPressEnter={() => { setPage(1); load(); }} allowClear style={{ width: 200 }} />
        <Button type="primary" onClick={() => { setPage(1); load(); }}>搜索</Button>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>
    }>
      <Table
        rowKey="id" loading={loading} columns={cols} dataSource={data.items}
        pagination={{
          current: page, pageSize, total: data.total, showSizeChanger: true,
          showTotal: (t) => `共 ${t} 个家庭组`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps || 20); },
        }}
      />
    </Card>
  );
}

function BroadcastsTab() {
  const [data, setData] = useState<{ items: FamilyBroadcastItem[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [groupId, setGroupId] = useState('');

  const load = () => {
    setLoading(true);
    listFamilyBroadcasts({ page, pageSize, groupId: groupId.trim() || undefined })
      .then(setData)
      .catch((e: any) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize]);

  const cols = [
    { title: '广播ID', dataIndex: 'id', key: 'id', width: 140, ellipsis: true },
    {
      title: '所属群', dataIndex: 'groupId', key: 'groupId', width: 140,
      render: (v: string) => <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.slice(0, 10)}…</Tag>
    },
    {
      title: '触发者', dataIndex: 'triggeredByUserId', key: 'triggeredByUserId', width: 140,
      render: (v: string) => <Tooltip title={v}><Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.slice(0, 10)}…</Tag></Tooltip>
    },
    { title: '类型', dataIndex: 'contentType', key: 'contentType', width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: '内容（脱敏）', dataIndex: 'contentDisplay', key: 'contentDisplay', ellipsis: true },
    {
      title: 'AI判定', dataIndex: 'resultLabel', key: 'resultLabel', width: 90,
      render: (v: string) => <Tag color={v === 'scam' ? 'red' : v === 'safe' ? 'green' : 'default'}>{v}</Tag>
    },
    { title: '来源', dataIndex: 'source', key: 'source', width: 110 },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
  ];

  return (
    <Card extra={
      <Space>
        <Input placeholder="按群 ID 筛选" value={groupId} onChange={(e) => setGroupId(e.target.value)} onPressEnter={() => { setPage(1); load(); }} allowClear style={{ width: 200 }} />
        <Button type="primary" onClick={() => { setPage(1); load(); }}>搜索</Button>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>
    }>
      <Table
        rowKey="id" loading={loading} columns={cols} dataSource={data.items} scroll={{ x: 1100 }}
        pagination={{
          current: page, pageSize, total: data.total, showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条广播`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps || 20); },
        }}
      />
    </Card>
  );
}

function CareNoticesTab() {
  const [data, setData] = useState<{ items: FamilyCareNoticeItem[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = () => {
    setLoading(true);
    listFamilyCareNotices({ page, pageSize })
      .then(setData)
      .catch((e: any) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize]);

  const cols = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 120, ellipsis: true },
    { title: '群 ID', dataIndex: 'groupId', key: 'groupId', width: 140, render: (v: string) => <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.slice(0, 10)}…</Tag> },
    { title: '未活跃用户', dataIndex: 'inactiveUserId', key: 'inactiveUserId', width: 140, render: (v: string) => <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.slice(0, 10)}…</Tag> },
    { title: '未活跃天数', dataIndex: 'daysInactive', key: 'daysInactive', width: 100, render: (v: number) => <Tag color={v >= 3 ? 'red' : v >= 2 ? 'orange' : 'default'}>{v} 天</Tag> },
    { title: '通知渠道', dataIndex: 'channel', key: 'channel', width: 90, render: (v: string) => <Tag>{v}</Tag> },
    { title: '通知数', key: 'notified', width: 80, render: (_: unknown, row: FamilyCareNoticeItem) => (Array.isArray(row.notifiedUserIds) ? row.notifiedUserIds.length : 0) },
    { title: '发送时间', dataIndex: 'sentAt', key: 'sentAt', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
  ];

  return (
    <Card extra={<Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>}>
      <Table
        rowKey="id" loading={loading} columns={cols} dataSource={data.items} scroll={{ x: 1000 }}
        pagination={{
          current: page, pageSize, total: data.total, showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条关怀通知`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps || 20); },
        }}
      />
    </Card>
  );
}

export default function FamilyGroupsList() {
  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1F2D3D' }}>家庭守护（V3-E）</h2>
      <Tabs
        defaultActiveKey="groups"
        items={[
          { key: 'groups', label: '家庭组列表', children: <GroupsTab /> },
          { key: 'broadcasts', label: '广播流水', children: <BroadcastsTab /> },
          { key: 'care', label: '关怀通知', children: <CareNoticesTab /> },
        ]}
      />
    </div>
  );
}
