import { useEffect, useState } from 'react';
import { Table, Card, Input, Select, Space, Button, DatePicker, message, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getQueries, type QueryItem, type QueriesRes } from '../../api/queries';

const riskColor: Record<string, string> = {
  high: '#FF4D4F',
  medium: '#F5A623',
  low: '#2ECC71',
  unknown: '#8A94A6',
};

export default function QueriesList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: QueryItem[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [riskLevel, setRiskLevel] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    const [startDate, endDate] = dateRange ?? [];
    getQueries({ page, pageSize, riskLevel, startDate, endDate })
      .then((res) => setData({ items: (res as unknown as QueriesRes).items, total: (res as unknown as QueriesRes).total }))
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, pageSize, riskLevel, dateRange?.[0], dateRange?.[1]]);

  const columns = [
    { title: 'query_id', dataIndex: 'id', key: 'id', ellipsis: true, width: 200 },
    { title: 'user_id', dataIndex: 'userId', key: 'userId', width: 180 },
    { title: 'input_type', dataIndex: 'inputType', key: 'inputType', width: 100 },
    {
      title: '截图',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 72,
      render: (url: string | null | undefined) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" title="查看原图">
            <img src={url} alt="用户上传" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: 'content',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (v: string) => (v && v.length > 50 ? v.slice(0, 50) + '...' : v),
    },
    {
      title: 'risk_level',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 100,
      render: (v: string) => <Tag color={riskColor[v?.toLowerCase()] ?? '#8A94A6'}>{v}</Tag>,
    },
    { title: 'confidence', dataIndex: 'confidence', key: 'confidence', width: 90 },
    { title: 'ai_provider', dataIndex: 'aiProvider', key: 'aiProvider', width: 100 },
    {
      title: 'created_at',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => v?.slice(0, 19),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, row: QueryItem) => (
        <Button type="link" size="small" onClick={() => navigate(`/queries/${row.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  const filteredItems = search
    ? data.items.filter((q) => q.content?.toLowerCase().includes(search.toLowerCase()) || q.id?.includes(search))
    : data.items;

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>AI 查询记录</h2>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Search placeholder="关键词搜索" allowClear onSearch={setSearch} style={{ width: 200 }} />
          <Select
            placeholder="风险等级"
            allowClear
            style={{ width: 120 }}
            onChange={setRiskLevel}
            options={[
              { label: '高', value: 'high' },
              { label: '中', value: 'medium' },
              { label: '低', value: 'low' },
              { label: '未知', value: 'unknown' },
            ]}
          />
          <DatePicker.RangePicker
            onChange={(dates) =>
              setDateRange(
                dates?.[0] && dates?.[1]
                  ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]
                  : null
              )
            }
          />
          <Button type="primary" onClick={load}>
            查询
          </Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredItems}
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
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
}
