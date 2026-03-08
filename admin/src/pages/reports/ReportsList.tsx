import { useEffect, useState } from 'react';
import { Table, Card, Select, Space, Button, message, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getReports, updateReportStatus, type ReportItem, type ReportStatus } from '../../api/reports';

const statusMap: Record<ReportStatus, string> = {
  PENDING: '待处理',
  HANDLED: '已处理',
  REJECTED: '已拒绝',
};

const statusColor: Record<ReportStatus, string> = {
  PENDING: '#F5A623',
  HANDLED: '#2ECC71',
  REJECTED: '#FF4D4F',
};

export default function ReportsList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: ReportItem[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<ReportStatus | undefined>();

  const load = () => {
    setLoading(true);
    getReports({ page, pageSize, status })
      .then((res) => setData({ items: res.items, total: res.total }))
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, pageSize, status]);

  const handleStatus = (id: string, newStatus: ReportStatus, remark?: string) => {
    updateReportStatus(id, newStatus, remark)
      .then(() => {
        message.success('操作成功');
        load();
      })
      .catch((e) => message.error(e?.message ?? '操作失败'));
  };

  const columns = [
    { title: 'report_id', dataIndex: 'id', key: 'id', ellipsis: true, width: 200 },
    { title: 'user_id', dataIndex: 'userId', key: 'userId', width: 180 },
    { title: 'type', dataIndex: 'type', key: 'type', width: 100 },
    {
      title: 'content',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (v: string) => (v && v.length > 60 ? v.slice(0, 60) + '...' : v),
    },
    {
      title: 'status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: ReportStatus) => <Tag color={statusColor[v]}>{statusMap[v]}</Tag>,
    },
    { title: 'created_at', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (v: string) => v?.slice(0, 19) },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: unknown, row: ReportItem) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate(`/reports/${row.id}`)}>
            详情
          </Button>
          {row.status === 'PENDING' && (
            <>
              <Button type="link" size="small" onClick={() => handleStatus(row.id, 'HANDLED')}>
                标记处理
              </Button>
              <Button type="link" size="small" danger onClick={() => handleStatus(row.id, 'REJECTED')}>
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>举报管理</h2>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 120 }}
            onChange={setStatus}
            options={[
              { label: '待处理', value: 'PENDING' },
              { label: '已处理', value: 'HANDLED' },
              { label: '已拒绝', value: 'REJECTED' },
            ]}
          />
          <Button type="primary" onClick={load}>
            查询
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
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
}
