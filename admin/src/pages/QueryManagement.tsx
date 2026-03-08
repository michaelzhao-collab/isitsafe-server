import { useState, useEffect } from 'react';
import { Table, Card, Button, Space, message } from 'antd';
import { api } from '../api/client';

export default function QueryManagement() {
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.queries({ page, pageSize });
      setData(res);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, pageSize]);

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, render: (t: string) => t?.slice(0, 8) + '...' },
    { title: '问题', dataIndex: 'question', key: 'question', ellipsis: true },
    { title: '来源', dataIndex: 'source', key: 'source' },
    { title: '状态', dataIndex: 'status', key: 'status' },
    { title: 'AI 模型', dataIndex: 'aiModel', key: 'aiModel' },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt' },
  ];

  return (
    <Card title="查询管理">
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
