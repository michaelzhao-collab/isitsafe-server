import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Divider, Tag, Space } from 'antd';
import { getAnalyticsOverview } from '../../api/analytics';
import request from '../../api/request';

const riskColor: Record<string, string> = {
  low: '#2ECC71',
  medium: '#F5A623',
  high: '#FF4D4F',
  unknown: '#8A94A6',
};

interface GmvByCurrency { currency: string; total: number }

interface SubscriptionSummary {
  activeSubscriptions: number;
  todayNewOrders: number;
  monthNewOrders: number;
  todayRefunds: number;
  monthRefunds: number;
  renewalRatePercent: number | null;
  todayGmvByCurrency: GmvByCurrency[];
  monthGmvByCurrency: GmvByCurrency[];
}

function gmvText(rows: GmvByCurrency[]): string {
  if (!rows || rows.length === 0) return '0';
  return rows
    .map((r) => `${r.currency || '?'} ${Number(r.total ?? 0).toFixed(2)}`)
    .join(' / ');
}

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
  const [sub, setSub] = useState<SubscriptionSummary | null>(null);

  useEffect(() => {
    Promise.allSettled([
      getAnalyticsOverview(),
      request.get('/admin/subscription/summary'),
    ])
      .then(([oRes, sRes]) => {
        if (oRes.status === 'fulfilled') {
          const res: any = oRes.value;
          setData({
            totalQueries: res.totalQueries ?? 0,
            todayQueries: res.todayQueries ?? 0,
            totalHighRiskCount: res.totalHighRiskCount ?? res.highRiskCount ?? 0,
            todayHighRiskCount: res.todayHighRiskCount ?? 0,
            totalUsers: res.totalUsers,
            riskDistribution: res.riskDistribution,
          });
        }
        if (sRes.status === 'fulfilled') {
          setSub(sRes.value as unknown as SubscriptionSummary);
        }
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
      <h2 style={{ marginBottom: 8, color: '#1F2D3D' }}>Dashboard</h2>
      <Divider orientation="left" plain style={{ margin: '8px 0 16px' }}>
        <Space size={6}><Tag color="blue">查询 / 用户</Tag></Space>
      </Divider>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="累计查询量" value={data.totalQueries ?? 0} suffix="次" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="今日查询量" value={data.todayQueries ?? 0} suffix="次" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="累计高风险案例数"
              value={data.totalHighRiskCount ?? 0}
              valueStyle={{ color: '#FF4D4F' }}
              suffix="例"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日高风险案例数"
              value={data.todayHighRiskCount ?? 0}
              valueStyle={{ color: '#FF4D4F' }}
              suffix="例"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="用户总数" value={data.totalUsers ?? 0} suffix="人" />
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

      <Divider orientation="left" plain style={{ margin: '24px 0 16px' }}>
        <Space size={6}><Tag color="gold">订阅 / 营收</Tag></Space>
      </Divider>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃订阅"
              value={sub?.activeSubscriptions ?? 0}
              valueStyle={{ color: '#3F8600' }}
              suffix="人"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="今日新订单" value={sub?.todayNewOrders ?? 0} suffix="单" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="本月新订单" value={sub?.monthNewOrders ?? 0} suffix="单" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="续费率"
              value={sub?.renewalRatePercent ?? 0}
              suffix={sub?.renewalRatePercent != null ? '%' : ' —'}
              valueStyle={{ color: '#3F8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="今日 GMV（按币种）"
              value={gmvText(sub?.todayGmvByCurrency ?? [])}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="本月 GMV（按币种）"
              value={gmvText(sub?.monthGmvByCurrency ?? [])}
              valueStyle={{ color: '#3F8600', fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Space size="large">
              <Statistic
                title="今日退款"
                value={sub?.todayRefunds ?? 0}
                valueStyle={{ color: '#FF4D4F' }}
                suffix="单"
              />
              <Statistic
                title="本月退款"
                value={sub?.monthRefunds ?? 0}
                valueStyle={{ color: '#FF4D4F' }}
                suffix="单"
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
