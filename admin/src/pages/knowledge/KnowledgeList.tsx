import { useEffect, useState, useRef } from 'react';
import { Table, Card, Select, Input, Space, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { getKnowledge, deleteKnowledge, bulkImportKnowledge, type KnowledgeItem, type KnowledgeListRes } from '../../api/knowledge';
import { KNOWLEDGE_CATEGORIES } from '../../api/knowledge';

export default function KnowledgeList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: KnowledgeItem[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [category, setCategory] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    getKnowledge({ page, pageSize, category, search: search || undefined })
      .then((res) => setData({ items: (res as unknown as KnowledgeListRes).items, total: (res as unknown as KnowledgeListRes).total }))
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

  const handleBulkImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = reader.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: '' }) as string[][];
        const items: Array<{ title: string; category: string; content: string }> = [];
        const isHeader = (row: string[]) => {
          const first = String(row[0] ?? '').trim();
          return first === '标题' || first === 'title' || first === 'Title';
        };
        let start = 0;
        if (rows.length > 0 && isHeader(rows[0])) start = 1;
        for (let i = start; i < rows.length; i++) {
          const row = rows[i];
          const title = String(row?.[0] ?? '').trim();
          const category = String(row?.[1] ?? '').trim();
          const content = String(row?.[2] ?? '').trim();
          if (title || category || content) {
            items.push({ title: title || '未命名', category: category || '未分类', content });
          }
        }
        if (items.length === 0) {
          message.warning('Excel 中无有效数据（需要至少：标题、分类、正文三列）');
          e.target.value = '';
          return;
        }
        setImporting(true);
        bulkImportKnowledge(items)
          .then((res) => {
            message.success(`批量导入成功，共 ${res.created} 条`);
            load();
          })
          .catch((err) => message.error(err?.response?.data?.message ?? err?.message ?? '导入失败'))
          .finally(() => {
            setImporting(false);
            e.target.value = '';
          });
      } catch (err) {
        message.error('解析 Excel 失败，请确认文件为 xlsx/xls 且包含标题、分类、正文三列');
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          <Button
            icon={<UploadOutlined />}
            loading={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            批量导入
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleBulkImportFile}
          />
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
