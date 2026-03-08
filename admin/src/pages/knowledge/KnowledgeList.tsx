import { useEffect, useState } from 'react';
import { Table, Card, Select, Input, Space, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import { getKnowledge, deleteKnowledge, type KnowledgeItem } from '../../api/knowledge';
import { KNOWLEDGE_CATEGORIES } from '../../api/knowledge';

export default function KnowledgeList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: KnowledgeItem[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [category, setCategory] = useState<string | undefined>();
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    getKnowledge({ page, pageSize, category, search: search || undefined })
      .then((res) => setData({ items: res.items, total: res.total }))
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, pageSize, category]);

  const handleSearch = () => {
    setPage(1);
    load();
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定删除？')) return;
    deleteKnowledge(id)
      .then(() => {
        message.success('已删除');
        load();
      })
      .catch((e) => message.error(e?.message ?? '删除失败'));
  };

  const columns = [
    { title: 'id', dataIndex: 'id', key: 'id', ellipsis: true, width: 200 },
    { title: 'title', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'category', dataIndex: 'category', key: 'category', width: 120 },
    {
      title: 'content',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (v: string) => (v && v.length > 60 ? v.slice(0, 60) + '...' : v),
    },
    {
      title: 'tags',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (tags: string[]) => (Array.isArray(tags) ? tags.join(', ') : '-'),
    },
    { title: 'source', dataIndex: 'source', key: 'source', width: 100 },
    { title: 'language', dataIndex: 'language', key: 'language', width: 80 },
    { title: 'created_at', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (v: string) => v?.slice(0, 19) },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: unknown, row: KnowledgeItem) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate(`/knowledge/${row.id}/edit`, { state: { row } })}>
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
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>知识库（RAG 案例）</h2>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Search
            placeholder="关键词搜索"
            allowClear
            onSearch={handleSearch}
            style={{ width: 200 }}
          />
          <Select
            placeholder="category"
            allowClear
            style={{ width: 140 }}
            onChange={setCategory}
            options={KNOWLEDGE_CATEGORIES.map((c) => ({ label: c, value: c }))}
          />
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/knowledge/new')}>
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
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
}
