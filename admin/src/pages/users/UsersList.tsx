import { useEffect, useState } from 'react';
import { Table, Card, Input, Select, Space, Button, message, Tag, Avatar, Popconfirm } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getUsers, updateUserStatus, type UserItem, type UsersRes } from '../../api/users';
import request from '../../api/request';

export default function UsersList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: UserItem[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [country, setCountry] = useState<string | undefined>();
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    getUsers({ page, pageSize, country })
      .then((res) => setData({ items: (res as unknown as UsersRes).items, total: (res as unknown as UsersRes).total }))
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, pageSize, country]);

  const handleStatus = (id: string, status: string) => {
    updateUserStatus(id, status)
      .then(() => {
        message.success('操作成功');
        load();
      })
      .catch((e) => message.error(e?.message ?? '操作失败'));
  };

  const [backfilling, setBackfilling] = useState(false);
  const handleBackfillCountry = async () => {
    setBackfilling(true);
    try {
      const res = await request.post<{ scanned: number; updated: number; stillEmpty: number; hint: string }>('/admin/users/backfill-country');
      const r = res as unknown as { scanned: number; updated: number; stillEmpty: number; hint: string };
      message.success(`扫描 ${r.scanned} 个用户，补齐 ${r.updated} 个；${r.hint}`, 6);
      load();
    } catch (e: any) {
      message.error(e?.message ?? '回填失败');
    } finally {
      setBackfilling(false);
    }
  };

  const genderMap: Record<string, string> = { male: '男', female: '女', unknown: '-' };

  const columns = [
    { title: '用户ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 140, render: (v: string) => v || '—' },
    {
      title: '头像',
      dataIndex: 'avatar',
      key: 'avatar',
      width: 64,
      render: (url: string | null) => <Avatar src={url || undefined} size={40} />,
    },
    { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 100 },
    { title: '手机', dataIndex: 'phone', key: 'phone', width: 120 },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 90,
      render: (v: string | null) => v ? <Tag>{v}</Tag> : <span style={{ color: '#bfbfbf' }}>未知</span>,
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 70,
      render: (v: string) => genderMap[v] ?? v ?? '-',
    },
    { title: '生日', dataIndex: 'birthday', key: 'birthday', width: 110 },
    { title: '注册时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—' },
    { title: '最后登录', dataIndex: 'lastLogin', key: 'lastLogin', width: 160, render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—' },
    {
      title: '会员状态',
      dataIndex: 'subscriptionStatus',
      key: 'subscriptionStatus',
      width: 90,
      render: (v: string) =>
        v === 'premium' ? (
          <Tag color="green">会员</Tag>
        ) : (
          <span style={{ color: '#5F6B7A' }}>免费</span>
        ),
    },
    {
      title: '到期时间',
      dataIndex: 'subscriptionExpire',
      key: 'subscriptionExpire',
      width: 120,
      render: (v: string | null) => (v ? v.slice(0, 10) : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_: unknown, row: UserItem) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate(`/users/${row.id}`)}>
            详情
          </Button>
          <Popconfirm
            title={`确认禁用 ${row.nickname || row.phone || row.id.slice(0, 8)}？`}
            description="禁用后该用户所有 API 请求被 403 拦截"
            onConfirm={() => handleStatus(row.id, 'disabled')}
            okText="禁用" cancelText="取消" okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger>禁用</Button>
          </Popconfirm>
          <Popconfirm
            title="确认解封该用户？"
            onConfirm={() => handleStatus(row.id, 'active')}
            okText="解封" cancelText="取消"
          >
            <Button type="link" size="small">解封</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>用户管理</h2>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Search
            placeholder="搜索手机/邮箱"
            allowClear
            onSearch={(v) => setSearch(v)}
            style={{ width: 200 }}
          />
          <Select
            placeholder="国家"
            allowClear
            style={{ width: 120 }}
            onChange={setCountry}
            options={[{ label: 'CN', value: 'CN' }, { label: '其他', value: 'OTHER' }]}
          />
          <Button type="primary" onClick={load}>
            查询
          </Button>
          <Popconfirm
            title="按手机号前缀批量回填国家"
            description="扫描所有 country 为空且有手机号的用户，按 E.164 前缀写入国家码。非手机号用户等下次登录由系统自动补写。"
            onConfirm={handleBackfillCountry}
            okText="开始" cancelText="取消"
          >
            <Button icon={<GlobalOutlined />} loading={backfilling}>
              回填国家
            </Button>
          </Popconfirm>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data.items.filter(
            (u) => !search || [u.phone, u.email].some((s) => s && String(s).includes(search))
          )}
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
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}
