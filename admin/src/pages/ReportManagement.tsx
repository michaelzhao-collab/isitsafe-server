import { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Tag, message } from 'antd';
import { api } from '../api/client';

const statusMap: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'orange', text: '待处理' },
  HANDLED: { color: 'green', text: '已处理' },
  REJECTED: { color: 'red', text: '驳回' },
};

export default function ReportManagement() {
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [stats, setStats] = useState<{ pending: number; handled: number; rejected: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = async () => {
    setLoading(true);
    try {
      const [res, s] = await Promise.all([api.reports({ page, pageSize }), api.reportStats()]);
      setData(res);
      setStats(s);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, pageSize]);

  const setStatus = async (id: string, status: string) => {
    try {
      await api.reportStatus(id, status);
      message.success('已更新');
      load();
    } catch (e: any) {
      message.error(e?.message || '操作失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, render: (t: string) => t?.slice(0, 8) + '...' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const m = statusMap[s] || { color: 'default', text: s };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, row: any) =>
        row.status === 'PENDING' ? (
          <Space>
            <Button size="small" type="link" onClick={() => setStatus(row.id, 'HANDLED')}>
              已处理
            </Button>
            <Button size="small" type="link" danger onClick={() => setStatus(row.id, 'REJECTED')}>
              驳回
            </Button>
          </Space>
        ) : null,
    },
  ];

  return (
    <Card title="举报管理">
      {stats && (
        <Space style={{ marginBottom: 16 }}>
          <Tag color="orange">待处理: {stats.pending}</Tag>
          <Tag color="green">已处理: {stats.handled}</Tag>
          <Tag color="red">驳回: {stats.rejected}</Tag>
        </Space>
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={load} loading={loading}>
          刷新
        </Button>
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
          onChange: (p, ps) => {
            setPage(p);
            if (typeof ps === 'number') setPageSize(ps);
          },
        }}
      />
    </Card>
  );
}
