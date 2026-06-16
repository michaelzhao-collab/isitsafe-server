import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Button, Input, message, Tag, Descriptions, Space, Alert, Collapse, Spin,
} from 'antd';
import { BugOutlined, ReloadOutlined, ThunderboltOutlined, KeyOutlined } from '@ant-design/icons';
import request from '../../api/request';

interface PushConfig {
  APNS_TEAM_ID: boolean;
  APNS_TEAM_ID_value: string;
  APNS_TEAM_ID_hasTrailingWhitespace: boolean;
  APNS_KEY_ID: boolean;
  APNS_KEY_ID_value: string;
  APNS_KEY_ID_hasTrailingWhitespace: boolean;
  APNS_AUTH_KEY: boolean;
  APNS_BUNDLE_ID: string | null;
  APNS_ENV: string;
  authKeyLength: number;
  authKeyStartsWith: string;
  authKeyEndsWith: string;
  hasBomHead: boolean;
  hasBeginHeader: boolean;
  hasEndFooter: boolean;
  hasLiteralBackslashN: boolean;
  hasRealNewline: boolean;
  lineCount: number;
  hasNonAsciiSpace: boolean;
  base64Len: number;
  base64LengthLooksRight: boolean;
  signTestResult: { ok: boolean; error?: string };
}

interface WebhookHistoryItem {
  id: string;
  userId: string;
  status: string;
  lastEventType: string | null;
  productId: string;
  transactionId: string | null;
  originalTransactionId: string | null;
  expireTime: string;
  environment: string | null;
  updatedAt: string;
  appleEvents: any[];
}

export default function DiagnosticsPage() {
  const [cfg, setCfg] = useState<PushConfig | null>(null);
  const [cfgLoading, setCfgLoading] = useState(true);
  const [history, setHistory] = useState<WebhookHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [testUserId, setTestUserId] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [jwt, setJwt] = useState<any>(null);
  const [jwtLoading, setJwtLoading] = useState(false);

  const loadCfg = () => {
    setCfgLoading(true);
    request
      .get('/admin/diagnostics/push-config')
      .then((res) => setCfg(res as unknown as PushConfig))
      .catch((e: any) => message.error(e?.message ?? '加载推送配置失败'))
      .finally(() => setCfgLoading(false));
  };

  const loadHistory = () => {
    setHistoryLoading(true);
    request
      .get('/admin/diagnostics/apple-webhook-history')
      .then((res: any) => setHistory(res?.items ?? []))
      .catch((e: any) => message.error(e?.message ?? '加载历史失败'))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    loadCfg();
    loadHistory();
  }, []);

  const runTestPush = async () => {
    const uid = testUserId.trim();
    if (!uid) return message.warning('请输入 userId');
    setTesting(true);
    setTestResult(null);
    try {
      const res = await request.post('/admin/diagnostics/test-push', {
        userId: uid,
        title: 'StarLens 测试推送',
        body: '如果你看到这条，说明 APNs Key 与设备 token 都正常',
      });
      setTestResult(res);
      if ((res as any)?.ok) message.success('推送已发出');
      else message.warning(`未送达：${(res as any)?.reason ?? '未知'}`);
    } catch (e: any) {
      message.error(e?.message ?? '发送失败');
    } finally {
      setTesting(false);
    }
  };

  const runShowJwt = async () => {
    setJwtLoading(true);
    setJwt(null);
    try {
      const res = await request.get('/admin/diagnostics/show-jwt');
      setJwt(res);
    } catch (e: any) {
      message.error(e?.message ?? '获取 JWT 失败');
    } finally {
      setJwtLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1F2D3D' }}>
        <BugOutlined /> 推送诊断 / Apple 排查
      </h2>

      <Card
        size="small"
        title="APNs 配置健康"
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadCfg}>刷新</Button>}
        style={{ marginBottom: 16 }}
      >
        {cfgLoading ? <Spin /> : cfg ? (
          <>
            {cfg.signTestResult?.ok ? (
              <Alert type="success" showIcon style={{ marginBottom: 12 }}
                message="当前 env 可以成功签出 APNs JWT —— Key 形状没问题" />
            ) : (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 12 }}
                message={`签 JWT 失败：${cfg.signTestResult?.error ?? '未知错误'}`}
                description="说明 APNS_AUTH_KEY 当前形状不能被 node crypto 接受。常见原因：手动 \\n 转义、缺 BEGIN/END 行、复制时带了 BOM。"
              />
            )}
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="APNS_ENV">{cfg.APNS_ENV}</Descriptions.Item>
              <Descriptions.Item label="APNS_BUNDLE_ID">
                {cfg.APNS_BUNDLE_ID ?? <Tag color="red">缺失</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="APNS_TEAM_ID">
                {cfg.APNS_TEAM_ID ? <span>{cfg.APNS_TEAM_ID_value}</span> : <Tag color="red">缺失</Tag>}
                {cfg.APNS_TEAM_ID_hasTrailingWhitespace && <Tag color="orange">含空白</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="APNS_KEY_ID">
                {cfg.APNS_KEY_ID ? <span>{cfg.APNS_KEY_ID_value}</span> : <Tag color="red">缺失</Tag>}
                {cfg.APNS_KEY_ID_hasTrailingWhitespace && <Tag color="orange">含空白</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="AUTH_KEY 长度">{cfg.authKeyLength}</Descriptions.Item>
              <Descriptions.Item label="行数">{cfg.lineCount}</Descriptions.Item>
              <Descriptions.Item label="BEGIN/END 行">
                {cfg.hasBeginHeader && cfg.hasEndFooter
                  ? <Tag color="green">完整</Tag>
                  : <Tag color="red">缺失</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="base64 主体长度">
                {cfg.base64Len}
                {cfg.base64LengthLooksRight
                  ? <Tag color="green" style={{ marginLeft: 8 }}>正常 ≈ 220</Tag>
                  : <Tag color="orange" style={{ marginLeft: 8 }}>异常</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="有 BOM 头">
                {cfg.hasBomHead ? <Tag color="red">是（需删）</Tag> : <Tag color="green">否</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="字面 \n">
                {cfg.hasLiteralBackslashN ? <Tag color="orange">是（normalize 会处理）</Tag> : <Tag color="green">否</Tag>}
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : null}
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card size="small" title={<><ThunderboltOutlined /> 发测试 push</>}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="输入 userId"
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
              />
              <Button type="primary" loading={testing} onClick={runTestPush}>
                发送
              </Button>
            </Space.Compact>
            {testResult && (
              <pre style={{ marginTop: 12, fontSize: 11, background: '#f6f8fa', padding: 8, maxHeight: 220, overflow: 'auto' }}>
                {JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            title={<><KeyOutlined /> 看 JWT 内容（对照 Apple Developer 后台）</>}
            extra={<Button size="small" loading={jwtLoading} onClick={runShowJwt}>生成</Button>}
          >
            {jwt ? (
              <pre style={{ fontSize: 11, background: '#f6f8fa', padding: 8, maxHeight: 220, overflow: 'auto' }}>
                {JSON.stringify(jwt, null, 2)}
              </pre>
            ) : (
              <div style={{ color: '#888', fontSize: 12 }}>点"生成"看当前 env 算出的 header / payload</div>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title="Apple webhook 历史（最近 20 条订阅）"
        extra={<Button size="small" icon={<ReloadOutlined />} loading={historyLoading} onClick={loadHistory}>刷新</Button>}
      >
        <Collapse
          size="small"
          items={history.map((h) => ({
            key: h.id,
            label: (
              <Space size={8}>
                <Tag color={h.status === 'active' ? 'green' : h.status === 'expired' ? 'orange' : 'default'}>{h.status}</Tag>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{h.userId.slice(0, 10)}…</span>
                <span style={{ fontSize: 12 }}>{h.productId}</span>
                <Tag color={h.environment === 'Sandbox' ? 'blue' : 'gold'}>{h.environment ?? '?'}</Tag>
                <span style={{ fontSize: 11, color: '#888' }}>{h.lastEventType ?? '—'}</span>
                <span style={{ fontSize: 11, color: '#888' }}>{h.updatedAt.slice(0, 19)}</span>
              </Space>
            ),
            children: h.appleEvents.length === 0
              ? <Tag>该订阅 historyLog 无 apple_notification 记录</Tag>
              : (
                <pre style={{ fontSize: 11, background: '#f6f8fa', padding: 8 }}>
                  {JSON.stringify(h.appleEvents, null, 2)}
                </pre>
              ),
          }))}
        />
      </Card>
    </div>
  );
}
