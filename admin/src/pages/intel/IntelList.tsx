import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Select, message, Popconfirm } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, RocketOutlined, InboxOutlined } from '@ant-design/icons';
import {
  listAlerts,
  deleteAlert,
  updateAlert,
  type IntelAlert,
  type IntelAlertListResponse,
} from '../../api/intel';

const SEVERITY_COLORS: Record<string, string> = {
  urgent: 'red',
  high: 'orange',
  normal: 'blue',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  pending: 'gold',
  published: 'green',
  archived: 'default',
};

export default function IntelList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: IntelAlert[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string | undefined>();
  const [language, setLanguage] = useState<string>('zh');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = () => {
    setLoading(true);
    listAlerts({ status, language, page, pageSize })
      .then((res) => {
        const r = res as unknown as IntelAlertListResponse;
        setData({ items: r.items, total: r.total });
      })
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status, language]);

  const handleDelete = (id: string) => {
    deleteAlert(id)
      .then(() => {
        message.success('已删除');
        load();
      })
      .catch((e) => message.error(e?.message ?? '删除失败'));
  };

  /** 批量切状态：published → 上架；draft → 下架 */
  const handleBulkSetStatus = async (next: 'published' | 'draft') => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      // 串行：避免后端写冲突；条数 ≤ 100，体感秒级完成
      let ok = 0;
      let fail = 0;
      for (const id of selectedIds) {
        try {
          await updateAlert(id, { status: next });
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      if (fail > 0) {
        message.warning(`成功 ${ok} 条，失败 ${fail} 条`);
      } else {
        message.success(`${next === 'published' ? '已上架' : '已下架'} ${ok} 条`);
      }
      setSelectedIds([]);
      load();
    } finally {
      setBulkLoading(false);
    }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: '严重度',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (s: string) => <Tag color={SEVERITY_COLORS[s] ?? 'default'}>{s}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{s}</Tag>,
    },
    { title: '分类', dataIndex: 'category', key: 'category', width: 120 },
    {
      title: '地区',
      dataIndex: 'targetRegions',
      key: 'targetRegions',
      width: 160,
      render: (regions: string[]) => (Array.isArray(regions) ? regions.join(', ') : '-'),
    },
    {
      title: '受众',
      dataIndex: 'targetAudiences',
      key: 'targetAudiences',
      width: 160,
      render: (auds: string[]) => (Array.isArray(auds) ? auds.join(', ') : '-'),
    },
    { title: '语言', dataIndex: 'language', key: 'language', width: 80 },
    {
      title: '发布于',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 170,
      render: (v: string | null | undefined) => (v ? v.slice(0, 19) : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_: unknown, row: IntelAlert) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/intel/${row.id}/edit`, { state: { row } })}
          >
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(row.id)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>情报中心</h2>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            value={status}
            onChange={setStatus}
            options={[
              { label: '草稿', value: 'draft' },
              { label: '待审', value: 'pending' },
              { label: '已发布', value: 'published' },
              { label: '已归档', value: 'archived' },
            ]}
          />
          <Select
            style={{ width: 140 }}
            value={language}
            onChange={setLanguage}
            options={[
              { label: '中文 (zh)', value: 'zh' },
              { label: 'English (en)', value: 'en' },
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/intel/new/edit', { state: { language } })}
          >
            新增情报
          </Button>
          <Button onClick={() => navigate('/intel/submissions')}>用户上报审批</Button>
          {selectedIds.length > 0 && (
            <>
              <span style={{ color: '#666', marginLeft: 8 }}>已选 {selectedIds.length} 条</span>
              <Popconfirm
                title={`批量上架 ${selectedIds.length} 条？`}
                description="上架后 iOS 客户端立即可见"
                onConfirm={() => handleBulkSetStatus('published')}
              >
                <Button type="primary" icon={<RocketOutlined />} loading={bulkLoading} ghost>
                  批量上架
                </Button>
              </Popconfirm>
              <Popconfirm
                title={`批量下架 ${selectedIds.length} 条？`}
                onConfirm={() => handleBulkSetStatus('draft')}
              >
                <Button icon={<InboxOutlined />} loading={bulkLoading}>
                  批量下架
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data.items}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as string[]),
          }}
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
          scroll={{ x: 1300 }}
        />
      </Card>
    </div>
  );
}
