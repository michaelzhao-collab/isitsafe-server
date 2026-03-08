import { useEffect, useState } from 'react';
import { Card, Descriptions, Button, Spin, message, Tag, Space } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import request from '../../api/request';
import { updateReportStatus, type ReportStatus } from '../../api/reports';

const statusMap: Record<ReportStatus, string> = {
  PENDING: '待处理',
  HANDLED: '已处理',
  REJECTED: '已拒绝',
};

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    request
      .get(`/admin/reports/${id}`)
      .then((res: any) => setReport(res))
      .catch(() => {
        message.error('接口未实现时请从列表查看');
        setReport(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatus = (newStatus: ReportStatus) => {
    if (!id) return;
    updateReportStatus(id, newStatus)
      .then(() => {
        message.success('操作成功');
        navigate('/reports');
      })
      .catch((e) => message.error(e?.message ?? '操作失败'));
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!report) {
    return (
      <Card>
        <p>未找到该举报或接口未实现</p>
        <Button type="primary" onClick={() => navigate('/reports')}>
          返回列表
        </Button>
      </Card>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>举报详情</h2>
      <Card>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="report_id">{String(report.id)}</Descriptions.Item>
          <Descriptions.Item label="user_id">{String(report.userId ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="type">{String(report.type ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="content">
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>{String(report.content ?? '')}</pre>
          </Descriptions.Item>
          <Descriptions.Item label="status">
            <Tag>{statusMap[report.status as ReportStatus] ?? String(report.status)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="created_at">
            {report.createdAt ? String(report.createdAt).slice(0, 19) : '-'}
          </Descriptions.Item>
        </Descriptions>
        {report.status === 'PENDING' && (
          <Space style={{ marginTop: 16 }}>
            <Button type="primary" onClick={() => handleStatus('HANDLED')}>
              标记处理
            </Button>
            <Button danger onClick={() => handleStatus('REJECTED')}>
              拒绝
            </Button>
          </Space>
        )}
        <div style={{ marginTop: 16 }}>
          <Button onClick={() => navigate('/reports')}>返回列表</Button>
        </div>
      </Card>
    </div>
  );
}
