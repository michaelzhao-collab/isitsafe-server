import { useEffect, useState } from 'react';
import { Table, Card, Tag } from 'antd';
import { getAdminUsers, type AdminUserItem, type AdminUsersRes } from '../../api/adminUsers';

export default function AdminUsersList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: AdminUserItem[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = () => {
    setLoading(true);
    getAdminUsers({ page, pageSize })
      .then((res) => setData({ items: (res as unknown as AdminUsersRes).items ?? [], total: (res as unknown as AdminUsersRes).total ?? 0 }))
      .catch(() => setData({ items: [], total: 0 }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, pageSize]);

  const columns = [
    { title: 'id', dataIndex: 'id', key: 'id', ellipsis: true, width: 200 },
    { title: 'username', dataIndex: 'username', key: 'username', width: 120 },
    { title: 'phone', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: 'email', dataIndex: 'email', key: 'email', width: 180 },
    {
      title: 'role',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (v: string) => (
        <Tag color={v === 'super_admin' ? '#FF4D4F' : '#2F6BFF'}>{v === 'super_admin' ? 'super_admin' : 'admin'}</Tag>
      ),
    },
    { title: 'created_at', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (v: string) => v?.slice(0, 19) ?? '-' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>管理员管理</h2>
      <Card>
        <p style={{ marginBottom: 16, color: '#5F6B7A' }}>
          super_admin：AI 配置、系统配置、管理员管理 | admin：用户管理、举报管理、知识库管理
        </p>
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
        />
      </Card>
    </div>
  );
}
