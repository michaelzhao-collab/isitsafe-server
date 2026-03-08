import { useState, useEffect } from 'react';
import { Card, Table, Statistic, Row, Col, message } from 'antd';
import { api } from '../api/client';

export default function Analytics() {
  const [stats, setStats] = useState<{ totalQueries: number; byStatus: any[]; highRiskCount: number } | null>(null);
  const [logs, setLogs] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.aiStats(), api.aiLogs({ page: 1, pageSize: 20 })])
      .then(([s, l]) => {
        if (!cancelled) {
          setStats(s);
          setLogs(l);
        }
      })
      .catch((e) => {
        if (!cancelled) message.error(e?.message || '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="总查询量" value={stats?.totalQueries ?? 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="高风险数量" value={stats?.highRiskCount ?? 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="最近记录数" value={logs.total} />
          </Card>
        </Col>
      </Row>
      <Card title="AI 查询日志">
        <Table
          rowKey="id"
          loading={loading}
          size="small"
          dataSource={logs.items}
          columns={[
            { title: '问题', dataIndex: 'question', key: 'question', ellipsis: true },
            { title: '状态', dataIndex: 'status', key: 'status' },
            { title: '模型', dataIndex: 'aiModel', key: 'aiModel' },
            { title: '时间', dataIndex: 'createdAt', key: 'createdAt' },
          ]}
          pagination={false}
        />
      </Card>
    </div>
  );
}
