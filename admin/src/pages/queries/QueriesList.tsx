import { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Space, message, Input, Select, DatePicker, Tag, Tooltip } from 'antd';
import { ReloadOutlined, ClearOutlined, CopyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import { getQueries, type QueryItem, type QueriesRes } from '../../api/queries';

const { RangePicker } = DatePicker;

const RISK_LEVEL_OPTIONS = [
  { label: '全部风险', value: '' },
  { label: '高风险', value: 'high' },
  { label: '中风险', value: 'medium' },
  { label: '低风险', value: 'low' },
  { label: '未知', value: 'unknown' },
];

const RISK_TAG_COLOR: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
  unknown: 'default',
};

export default function QueriesList() {
  const navigate = useNavigate();
  const [data, setData] = useState<QueriesRes>({ items: [], total: 0, page: 1, pageSize: 20 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 筛选项
  const [userId, setUserId] = useState('');
  const [userKeyword, setUserKeyword] = useState('');
  const [riskLevel, setRiskLevel] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const load = useCallback(async (overridePage?: number) => {
    setLoading(true);
    try {
      const res = (await getQueries({
        page: overridePage ?? page,
        pageSize,
        userId: userId.trim() || undefined,
        userKeyword: userKeyword.trim() || undefined,
        riskLevel: riskLevel || undefined,
        startDate: dateRange?.[0]?.startOf('day').toISOString(),
        endDate: dateRange?.[1]?.endOf('day').toISOString(),
      })) as unknown as QueriesRes;
      setData(res);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, userId, userKeyword, riskLevel, dateRange]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const onSearch = () => {
    setPage(1);
    load(1);
  };

  const onReset = () => {
    setUserId('');
    setUserKeyword('');
    setRiskLevel('');
    setDateRange(null);
    setPage(1);
    setTimeout(() => load(1), 0);
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => message.success('已复制'),
      () => message.error('复制失败'),
    );
  };

  const columns = [
    {
      title: '用户',
      key: 'user',
      width: 200,
      render: (_: unknown, row: QueryItem) => {
        if (!row.userId) return <span style={{ color: '#bfbfbf' }}>游客</span>;
        const name = row.user?.nickname || row.user?.phone || row.user?.email || row.userId.slice(0, 8) + '…';
        return (
          <Space size={4} direction="vertical">
            <span>{name}</span>
            <Space size={4}>
              <Tooltip title={row.userId}>
                <Tag
                  style={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
                  onClick={() => copy(row.userId!)}
                  icon={<CopyOutlined />}
                >
                  {row.userId.slice(0, 8)}…
                </Tag>
              </Tooltip>
              <a style={{ fontSize: 12 }} onClick={() => { setUserId(row.userId!); setPage(1); setTimeout(() => load(1), 0); }}>
                只看 ta
              </a>
            </Space>
          </Space>
        );
      },
    },
    {
      title: '类型',
      dataIndex: 'inputType',
      key: 'inputType',
      width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '截图',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 64,
      render: (url: string | null | undefined) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            <img src={url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
          </a>
        ) : (
          <span style={{ color: '#bfbfbf' }}>—</span>
        ),
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: { showTitle: false },
      render: (t: string) => (
        <Tooltip title={t} placement="topLeft">
          <span>{t}</span>
        </Tooltip>
      ),
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 90,
      render: (lv: string) => <Tag color={RISK_TAG_COLOR[lv] || 'default'}>{lv}</Tag>,
    },
    {
      title: '置信',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 70,
      render: (v?: number) => (v != null ? `${v}%` : '-'),
    },
    {
      title: 'AI',
      dataIndex: 'aiProvider',
      key: 'aiProvider',
      width: 90,
      render: (v?: string) => v || <span style={{ color: '#bfbfbf' }}>cache</span>,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (t: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      fixed: 'right' as const,
      render: (_: unknown, row: QueryItem) => (
        <Button type="link" size="small" onClick={() => navigate(`/queries/${row.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>AI 查询记录</h2>
      <Card extra={<Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>刷新</Button>}>
        <Space wrap style={{ marginBottom: 16 }} size={8}>
          <Input
            placeholder="用户 ID（精确）"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onPressEnter={onSearch}
            allowClear
            style={{ width: 220 }}
          />
          <Input
            placeholder="手机号 / 邮箱 / 昵称（模糊）"
            value={userKeyword}
            onChange={(e) => setUserKeyword(e.target.value)}
            onPressEnter={onSearch}
            allowClear
            style={{ width: 240 }}
          />
          <Select
            value={riskLevel}
            onChange={setRiskLevel}
            options={RISK_LEVEL_OPTIONS}
            style={{ width: 130 }}
          />
          <RangePicker
            value={dateRange}
            onChange={(v) => setDateRange(v as any)}
            placeholder={['开始日期', '结束日期']}
          />
          <Button type="primary" onClick={onSearch}>搜索</Button>
          <Button icon={<ClearOutlined />} onClick={onReset}>重置</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data.items}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              if (typeof ps === 'number') setPageSize(ps);
            },
          }}
        />
      </Card>
    </div>
  );
}
