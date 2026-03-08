import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import { getAnalyticsOverview } from '../../api/analytics';

const riskColor: Record<string, string> = {
  low: '#2ECC71',
  medium: '#F5A623',
  high: '#FF4D4F',
  unknown: '#8A94A6',
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    todayQueries?: number;
    todayAiCalls?: number;
    highRiskCount?: number;
    totalUsers?: number;
    riskDistribution?: Record<string, number>;
  }>({});

  useEffect(() => {
    getAnalyticsOverview()
      .then((res: any) => {
        setData({
          todayQueries: res.todayQueries ?? res.totalQueries ?? 0,
          todayAiCalls: res.todayAiCalls ?? res.aiLogsTotal ?? 0,
          highRiskCount: res.highRiskCount ?? 0,
          totalUsers: res.totalUsers,
          riskDistribution: res.riskDistribution,
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
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>Dashboard</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="今日查询量" value={data.todayQueries ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="今日 AI 调用量" value={data.todayAiCalls ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="高风险案例数" value={data.highRiskCount ?? 0} valueStyle={{ color: '#FF4D4F' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="用户总数" value={data.totalUsers ?? '-'} />
          </Card>
        </Col>
        {data.riskDistribution && Object.keys(data.riskDistribution).length > 0 && (
          <Col span={24}>
            <Card title="风险等级分布">
              <Row gutter={16}>
                {Object.entries(data.riskDistribution).map(([level, count]) => (
                  <Col key={level}>
                    <span style={{ color: riskColor[level] ?? '#8A94A6', marginRight: 8 }}>
                      {level === 'high' ? '高' : level === 'medium' ? '中' : level === 'low' ? '低' : '未知'}
                    </span>
                    <span>{count}</span>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
