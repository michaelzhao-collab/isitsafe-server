import { useEffect, useState } from 'react';
import { Table, Card, message, Select } from 'antd';
import { api, SubscriptionOrderItem } from '../../api/client';

const statusOptions = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '有效' },
  { value: 'expired', label: '已过期' },
  { value: 'cancelled', label: '已取消' },
];

export default function SubscriptionOrdersList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: SubscriptionOrderItem[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');

  const load = () => {
    setLoading(true);
    api
      .subscriptionOrders({ page, pageSize, status: status === 'all' ? undefined : status })
      .then((res) => setData({ items: res.items, total: res.total }))
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, pageSize, status]);

  const columns = [
    { title: '订单ID', dataIndex: 'id', key: 'id', width: 140, ellipsis: true },
    {
      title: '用户',
      key: 'user',
      width: 180,
      render: (_: unknown, row: SubscriptionOrderItem) =>
        row.user
          ? [row.user.phone || row.user.nickname || row.user.email || row.userId, row.userId].filter(Boolean).join(' / ')
          : row.userId,
    },
    { title: '商品ID', dataIndex: 'productId', key: 'productId', width: 120, ellipsis: true },
    { title: '周期', dataIndex: 'planType', key: 'planType', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => (v === 'active' ? '有效' : v === 'expired' ? '已过期' : v === 'cancelled' ? '已取消' : v),
    },
    {
      title: '到期时间',
      dataIndex: 'expireTime',
      key: 'expireTime',
      width: 180,
      render: (v: string) => (v ? v.slice(0, 19) : '—'),
    },
    { title: '交易号', dataIndex: 'transactionId', key: 'transactionId', width: 140, ellipsis: true, render: (v: string | null) => v || '—' },
    { title: '支付方式', dataIndex: 'paymentMethod', key: 'paymentMethod', width: 90 },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => (v ? v.slice(0, 19) : '—'),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>会员订单</h2>
      <Card
        title="订单列表"
        extra={
          <Select
            value={status}
            onChange={setStatus}
            options={statusOptions}
            style={{ width: 120 }}
          />
        }
      >
        <Table
          loading={loading}
          rowKey="id"
          columns={columns}
          dataSource={data.items}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps || 20);
            },
          }}
        />
      </Card>
    </div>
  );
}
