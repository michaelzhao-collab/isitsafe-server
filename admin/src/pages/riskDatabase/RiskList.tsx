import { useEffect, useState } from 'react';
import { Table, Card, Select, Space, Button, message, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import { getRiskData, deleteRiskData, type RiskItem, type RiskType, type RiskListRes } from '../../api/risk';

const riskTypes: { label: string; value: RiskType }[] = [
  { label: 'phone', value: 'phone' },
  { label: 'url', value: 'url' },
  { label: 'company', value: 'company' },
  { label: 'wallet', value: 'wallet' },
  { label: 'keyword', value: 'keyword' },
];

const riskColor: Record<string, string> = {
  high: '#FF4D4F',
  medium: '#F5A623',
  low: '#2ECC71',
};

export default function RiskList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: RiskItem[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [riskLevelFilter, setRiskLevelFilter] = useState<string | undefined>();

  const load = () => {
    setLoading(true);
    getRiskData({ page, pageSize, type: typeFilter, riskLevel: riskLevelFilter })
      .then((res) => setData({ items: (res as unknown as RiskListRes).items ?? [], total: (res as unknown as RiskListRes).total ?? 0 }))
      .catch(() => setData({ items: [], total: 0 }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, pageSize, typeFilter, riskLevelFilter]);

  const handleDelete = (id: string) => {
    if (!confirm('确定删除？')) return;
    deleteRiskData(id)
      .then(() => {
        message.success('已删除');
        load();
      })
      .catch((e) => message.error(e?.message ?? '删除失败'));
  };

  const columns = [
    { title: 'id', dataIndex: 'id', key: 'id', ellipsis: true, width: 200 },
    {
      title: 'type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v: RiskType) => <Tag>{v}</Tag>,
    },
    { title: 'content', dataIndex: 'content', key: 'content', ellipsis: true },
    {
      title: 'risk_level',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 100,
      render: (v: string) => <Tag color={riskColor[v?.toLowerCase()] ?? '#8A94A6'}>{v}</Tag>,
    },
    { title: 'risk_category', dataIndex: 'riskCategory', key: 'riskCategory', width: 120 },
    { title: 'source', dataIndex: 'source', key: 'source', width: 100 },
    {
      title: 'tags',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (tags: string[]) => (Array.isArray(tags) ? tags.join(', ') : '-'),
    },
    { title: 'created_at', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (v: string) => v?.slice(0, 19) },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: unknown, row: RiskItem) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate(`/risk-database/${row.id}/edit`)}>
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(row.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>风险数据库</h2>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="类型"
            allowClear
            style={{ width: 120 }}
            options={riskTypes}
            onChange={setTypeFilter}
          />
          <Select
            placeholder="风险等级"
            allowClear
            style={{ width: 120 }}
            onChange={setRiskLevelFilter}
            options={[
              { label: '高', value: 'high' },
              { label: '中', value: 'medium' },
              { label: '低', value: 'low' },
            ]}
          />
          <Button type="primary" onClick={load}>
            查询
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/risk-database/new')}>
            新增
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
