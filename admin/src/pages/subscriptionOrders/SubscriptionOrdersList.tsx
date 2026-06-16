import { useEffect, useState } from 'react';
import { Table, Card, message, Select, Input, Button, Space, Alert, Tag, Tooltip, Descriptions } from 'antd';
import { ReloadOutlined, BugOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { SubscriptionOrderItem } from '../../api/client';
import request from '../../api/request';

const statusOptions = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '有效' },
  { value: 'expired', label: '已过期' },
  { value: 'cancelled', label: '已取消' },
  { value: 'refunded', label: '已退款' },
  { value: 'revoked', label: '已撤销' },
];

interface Diagnostics {
  totalSubscriptions: number;
  subscriptionsByStatus: Array<{ status: string; count: number }>;
  usersPremiumCount: number;
  latestSubscription: { id: string; userId: string; productId: string; status: string; createdAt: string; paymentMethod: string } | null;
  orphanPremiumUsers: Array<{ id: string; phone: string | null; email: string | null; subscriptionExpire: string | null }>;
  hint: string;
}

export default function SubscriptionOrdersList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: SubscriptionOrderItem[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [userKeyword, setUserKeyword] = useState('');
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const load = () => {
    setLoading(true);
    request
      .get('/admin/subscription/orders', {
        params: {
          page,
          pageSize,
          status: status === 'all' ? undefined : status,
          userKeyword: userKeyword.trim() || undefined,
        },
      })
      .then((res) => setData(res as unknown as { items: SubscriptionOrderItem[]; total: number }))
      .catch((e: any) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  const loadDiagnostics = () => {
    setDiagLoading(true);
    request
      .get('/admin/subscription/diagnostics')
      .then((res) => setDiag(res as unknown as Diagnostics))
      .catch((e: any) => message.error(e?.message ?? '诊断接口失败'))
      .finally(() => setDiagLoading(false));
  };

  useEffect(() => {
    load();
    loadDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status]);

  const onSearch = () => {
    setPage(1);
    load();
  };

  const columns = [
    { title: '订单ID', dataIndex: 'id', key: 'id', width: 140, ellipsis: true },
    {
      title: '用户',
      key: 'user',
      width: 220,
      render: (_: unknown, row: SubscriptionOrderItem) => {
        const u = row.user;
        const display = u?.nickname || u?.phone || u?.email || row.userId.slice(0, 8) + '…';
        return (
          <Space direction="vertical" size={2}>
            <span>{display}</span>
            <Tooltip title={row.userId}>
              <Tag style={{ fontSize: 11, fontFamily: 'monospace' }}>{row.userId.slice(0, 10)}…</Tag>
            </Tooltip>
          </Space>
        );
      },
    },
    { title: '商品ID', dataIndex: 'productId', key: 'productId', width: 160, ellipsis: true },
    { title: '周期', dataIndex: 'planType', key: 'planType', width: 80 },
    {
      title: '状态',
      key: 'status',
      width: 130,
      render: (_: unknown, row: SubscriptionOrderItem) => {
        const v = row.effectiveStatus ?? row.status;
        const color = v === 'active' ? 'green' : v === 'expired' ? 'orange' : v === 'cancelled' ? 'default' : v === 'refunded' ? 'red' : 'default';
        const label = v === 'active' ? '有效' : v === 'expired' ? '已过期' : v === 'cancelled' ? '已取消' : v === 'refunded' ? '已退款' : v;
        return (
          <Space size={4}>
            <Tag color={color}>{label}</Tag>
            {row.isStale && (
              <Tooltip title="DB 仍标 active 但已过期，说明 Apple 续订/过期通知没到（每小时 cron 兜底修正）">
                <Tag color="red" style={{ fontSize: 11 }}>异常</Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '到期时间',
      dataIndex: 'expireTime',
      key: 'expireTime',
      width: 160,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '交易号',
      dataIndex: 'transactionId',
      key: 'transactionId',
      width: 180,
      ellipsis: true,
      render: (v: string | null) => {
        if (!v) return '—';
        const isDirty = v === '0' || v === 'null' || v === 'undefined';
        if (isDirty) {
          return (
            <Tooltip title="脏数据：iOS 早期版本兜底写入或沙箱测试残留，新版本已规范化为 null">
              <Tag color="red" style={{ fontFamily: 'monospace', fontSize: 11 }}>{v} ⚠</Tag>
            </Tooltip>
          );
        }
        return <Tooltip title={v}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span></Tooltip>;
      },
    },
    { title: '支付方式', dataIndex: 'paymentMethod', key: 'paymentMethod', width: 90 },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'),
    },
  ];

  const orphanCount = diag?.orphanPremiumUsers.length ?? 0;

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1F2D3D' }}>会员订单</h2>

      {diag && (
        <Card
          size="small"
          title={<><BugOutlined /> 订阅数据诊断</>}
          extra={
            <Space>
              <Button
                size="small"
                danger
                loading={reconciling}
                onClick={async () => {
                  setReconciling(true);
                  try {
                    const res = await request.post('/admin/subscription/reconcile-stale') as unknown as { ok: boolean; staleBeforeRun: number };
                    message.success(`已修复 ${res?.staleBeforeRun ?? 0} 条 stale 订阅`);
                    loadDiagnostics();
                    load();
                  } catch (e: any) {
                    message.error(e?.message ?? '修复失败');
                  } finally {
                    setReconciling(false);
                  }
                }}
              >
                一键修复 stale
              </Button>
              <Button size="small" icon={<ReloadOutlined />} loading={diagLoading} onClick={loadDiagnostics}>刷新</Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {orphanCount > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`检测到 ${orphanCount} 个用户 subscriptionStatus=premium 但 subscriptions 表没有记录`}
              description={
                <>
                  <div>{diag.hint}</div>
                  <div style={{ marginTop: 8, fontSize: 12 }}>常见原因：①iOS verify 接口失败但前端兜底改了 user 状态  ②Apple webhook 没配置 ③transactionId 唯一约束冲突</div>
                </>
              }
            />
          )}
          <Descriptions size="small" column={3} bordered>
            <Descriptions.Item label="subscriptions 表总记录">{diag.totalSubscriptions}</Descriptions.Item>
            <Descriptions.Item label="premium 用户数">{diag.usersPremiumCount}</Descriptions.Item>
            <Descriptions.Item label="孤儿 premium 用户">
              {orphanCount > 0 ? <Tag color="red">{orphanCount}</Tag> : <Tag color="green">0</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="按状态分布" span={3}>
              <Space wrap>
                {diag.subscriptionsByStatus.length === 0
                  ? <Tag>无数据</Tag>
                  : diag.subscriptionsByStatus.map((s) => <Tag key={s.status}>{s.status}: {s.count}</Tag>)
                }
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="最新订阅记录" span={3}>
              {diag.latestSubscription
                ? <span style={{ fontSize: 12 }}>{diag.latestSubscription.productId} · {diag.latestSubscription.status} · {dayjs(diag.latestSubscription.createdAt).format('YYYY-MM-DD HH:mm')} · {diag.latestSubscription.paymentMethod}</span>
                : <Tag color="red">表里完全没有订阅记录！</Tag>
              }
            </Descriptions.Item>
          </Descriptions>
          {orphanCount > 0 && (
            <div style={{ marginTop: 12 }}>
              <span style={{ fontSize: 12, color: '#999' }}>孤儿 premium 用户：</span>
              <Space wrap size={4} style={{ marginTop: 4 }}>
                {diag.orphanPremiumUsers.map((u) => (
                  <Tag key={u.id} color="orange">
                    {u.phone || u.email || u.id.slice(0, 8)} · 到期 {u.subscriptionExpire ? dayjs(u.subscriptionExpire).format('YYYY-MM-DD') : '—'}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </Card>
      )}

      <Card
        title="订单列表"
        extra={
          <Space>
            <Input
              placeholder="手机号 / 邮箱 / 昵称"
              value={userKeyword}
              onChange={(e) => setUserKeyword(e.target.value)}
              onPressEnter={onSearch}
              allowClear
              style={{ width: 200 }}
            />
            <Select value={status} onChange={setStatus} options={statusOptions} style={{ width: 120 }} />
            <Button type="primary" onClick={onSearch}>搜索</Button>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
          </Space>
        }
      >
        <Table
          loading={loading}
          rowKey="id"
          columns={columns}
          dataSource={data.items}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
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
