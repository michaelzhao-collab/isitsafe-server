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
    totalQueries?: number;
    todayQueries?: number;
    totalHighRiskCount?: number;
    todayHighRiskCount?: number;
    totalUsers?: number;
    riskDistribution?: Record<string, number>;
  }>({});

  useEffect(() => {
    getAnalyticsOverview()
      .then((res: any) => {
        setData({
          totalQueries: res.totalQueries ?? 0,
          todayQueries: res.todayQueries ?? 0,
          totalHighRiskCount: res.totalHighRiskCount ?? res.highRiskCount ?? 0,
          todayHighRiskCount: res.todayHighRiskCount ?? 0,
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
            <Statistic title="总的量" value={data.totalQueries ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="今日的量" value={data.todayQueries ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总的高风险案例数"
              value={data.totalHighRiskCount ?? 0}
              valueStyle={{ color: '#FF4D4F' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日高风险案例数"
              value={data.todayHighRiskCount ?? 0}
              valueStyle={{ color: '#FF4D4F' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="用户总数" value={data.totalUsers ?? 0} />
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
