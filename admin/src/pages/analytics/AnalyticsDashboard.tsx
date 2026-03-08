import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import { getAnalyticsOverview } from '../../api/analytics';
import { getAiStats } from '../../api/ai';

const riskColor: Record<string, string> = {
  low: '#2ECC71',
  medium: '#F5A623',
  high: '#FF4D4F',
  unknown: '#8A94A6',
};

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Record<string, unknown>>({});
  const [riskStats, setRiskStats] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      getAnalyticsOverview(),
      getAiStats().catch(() => ({})),
    ])
      .then(([ov, stats]: [any, any]) => {
        setOverview(ov);
        setRiskStats({
          high: ov.highRiskCount ?? stats.highRiskCount ?? 0,
          medium: 0,
          low: 0,
          unknown: 0,
          ...ov.riskDistribution,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>数据统计</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="每日查询量（当前统计）" value={(overview.todayQueries ?? overview.totalQueries ?? 0) as number} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="AI 调用量" value={(overview.todayAiCalls ?? overview.aiLogsTotal ?? 0) as number} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="高风险数量"
              value={(overview.highRiskCount ?? 0) as number}
              valueStyle={{ color: '#FF4D4F' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="用户总数" value={(overview.totalUsers ?? '-') as string | number} />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="风险等级分布">
            <Row gutter={24}>
              <Col>
                <span style={{ color: riskColor.high }}>高</span> {riskStats.high ?? 0}
              </Col>
              <Col>
                <span style={{ color: riskColor.medium }}>中</span> {riskStats.medium ?? 0}
              </Col>
              <Col>
                <span style={{ color: riskColor.low }}>低</span> {riskStats.low ?? 0}
              </Col>
              <Col>
                <span style={{ color: riskColor.unknown }}>未知</span> {riskStats.unknown ?? 0}
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
