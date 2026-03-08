import { useState, useEffect } from 'react';
import { Table, Card, Input, Button, Space, message } from 'antd';
import { api } from '../api/client';

export default function UserManagement() {
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.users({ page, pageSize });
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
    { title: '手机', dataIndex: 'phone', key: 'phone' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '国家', dataIndex: 'country', key: 'country' },
    { title: '角色', dataIndex: 'role', key: 'role' },
    { title: '最后登录', dataIndex: 'lastLogin', key: 'lastLogin' },
    { title: '注册时间', dataIndex: 'createdAt', key: 'createdAt' },
  ];

  return (
    <Card title="用户管理">
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
