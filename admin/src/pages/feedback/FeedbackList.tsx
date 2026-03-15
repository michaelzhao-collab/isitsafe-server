import { useEffect, useState } from 'react';
import { Table, Card, message, Image } from 'antd';
import { api, API_BASE } from '../../api/client';

type FeedbackItem = { id: string; userId: string | null; content: string; imageUrl: string | null; createdAt: string };

function fullImageUrl(url: string | null): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = API_BASE.replace(/\/api\/?$/, '');
  return base + (url.startsWith('/') ? url : '/' + url);
}

export default function FeedbackList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: FeedbackItem[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = () => {
    setLoading(true);
    api
      .feedback({ page, pageSize })
      .then((res) => setData({ items: res.items, total: res.total }))
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, pageSize]);

  const columns = [
    { title: '用户ID', dataIndex: 'userId', key: 'userId', width: 120, ellipsis: true, render: (v: string | null) => v || '—' },
    { title: '反馈内容', dataIndex: 'content', key: 'content', ellipsis: true, render: (v: string) => (v && v.length > 80 ? v.slice(0, 80) + '...' : v) },
    {
      title: '图片',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 100,
      render: (v: string | null) =>
        v ? (
          <Image
            src={fullImageUrl(v)}
            alt="反馈图"
            width={60}
            height={60}
            style={{ objectFit: 'cover' }}
            fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect fill='%23f0f0f0' width='60' height='60'/%3E%3Ctext x='50%25' y='50%25' fill='%23999' text-anchor='middle' dy='.3em' font-size='10'%3E加载失败%3C/text%3E%3C/svg%3E"
          />
        ) : (
          '—'
        ),
    },
    { title: '提交时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (v: string) => v?.slice(0, 19) },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>用户反馈</h2>
      <Card title="反馈列表（用户从客户端提交的文案与图片）">
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
