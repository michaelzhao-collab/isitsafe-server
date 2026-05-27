import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Select, message, Popconfirm, Drawer } from 'antd';
import {
  listSubmissions,
  reviewSubmission,
  type IntelSubmission,
  type IntelSubmissionListResponse,
} from '../../api/intel';

const STATUS_COLORS: Record<string, string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
  merged: 'blue',
};

export default function IntelSubmissions() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: IntelSubmission[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string | undefined>('pending');
  const [previewRow, setPreviewRow] = useState<IntelSubmission | null>(null);

  const load = () => {
    setLoading(true);
    listSubmissions({ status, page, pageSize })
      .then((res) => {
        const r = res as unknown as IntelSubmissionListResponse;
        setData({ items: r.items, total: r.total });
      })
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status]);

  const review = (id: string, action: 'approve' | 'reject' | 'merge') => {
    reviewSubmission(id, action)
      .then(() => {
        message.success('已处理');
        load();
      })
      .catch((e) => message.error(e?.message ?? '操作失败'));
  };

  const columns = [
    { title: 'id', dataIndex: 'id', key: 'id', width: 200, ellipsis: true },
    { title: '用户', dataIndex: 'userId', key: 'userId', width: 180, ellipsis: true },
    {
      title: '内容预览',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (v: string) => (v && v.length > 60 ? v.slice(0, 60) + '...' : v),
    },
    { title: '分类', dataIndex: 'category', key: 'category', width: 120, render: (v: string | null) => v ?? '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{s}</Tag>,
    },
    {
      title: '上报时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => v?.slice(0, 19),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right' as const,
      render: (_: unknown, row: IntelSubmission) => (
        <Space>
          <Button type="link" size="small" onClick={() => setPreviewRow(row)}>
            查看
          </Button>
          {row.status === 'pending' && (
            <>
              <Popconfirm title="批准这条上报？" onConfirm={() => review(row.id, 'approve')}>
                <Button type="link" size="small" style={{ color: '#16a34a' }}>
                  通过
                </Button>
              </Popconfirm>
              <Popconfirm title="驳回？" onConfirm={() => review(row.id, 'reject')}>
                <Button type="link" size="small" danger>
                  驳回
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>用户上报审批</h2>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 160 }}
            value={status}
            onChange={setStatus}
            allowClear
            placeholder="状态筛选"
            options={[
              { label: '待审 pending', value: 'pending' },
              { label: '已通过 approved', value: 'approved' },
              { label: '已驳回 rejected', value: 'rejected' },
              { label: '已合并 merged', value: 'merged' },
            ]}
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
          scroll={{ x: 1200 }}
        />
      </Card>
      <Drawer
        open={!!previewRow}
        onClose={() => setPreviewRow(null)}
        title="上报详情"
        width={520}
      >
        {previewRow && (
          <div style={{ lineHeight: 1.8 }}>
            <div>
              <strong>ID:</strong> {previewRow.id}
            </div>
            <div>
              <strong>用户:</strong> {previewRow.userId}
            </div>
            <div>
              <strong>分类:</strong> {previewRow.category ?? '-'}
            </div>
            <div>
              <strong>上报时间:</strong> {previewRow.createdAt?.slice(0, 19)}
            </div>
            <div>
              <strong>状态:</strong> <Tag color={STATUS_COLORS[previewRow.status] ?? 'default'}>{previewRow.status}</Tag>
            </div>
            <div style={{ marginTop: 16, padding: 12, background: '#F2F6FB', borderRadius: 6 }}>
              <strong>内容：</strong>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{previewRow.content}</div>
            </div>
            {Array.isArray(previewRow.attachments) && previewRow.attachments.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong>附件：</strong>
                <ul>
                  {previewRow.attachments.map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noopener noreferrer">{u}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
