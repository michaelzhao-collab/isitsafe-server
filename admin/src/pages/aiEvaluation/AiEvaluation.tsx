/**
 * V4-P0 AI 分析评测中心
 *
 * 工作流：
 * 1. 顶部统计卡：各 promptVersion 已采样 / 已评分 / 平均⭐
 * 2. 筛选条：promptVersion / intent / 评分状态
 * 3. 列表：每条样本一行，可展开看完整 prompt + AI 原始 raw + parsed result
 * 4. 行内打分：1-5 ⭐ + 可选 label / notes
 *
 * 目标：用户每天 5 分钟评 10 条，1 周后有 50-100 条 baseline 样本
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Select,
  message,
  Rate,
  Input,
  Statistic,
  Row,
  Col,
  Modal,
} from 'antd';
import { ReloadOutlined, FileTextOutlined } from '@ant-design/icons';
import {
  listAiEvalSamples,
  scoreAiEvalSample,
  getAiEvalStats,
  type AiEvalSample,
  type AiEvalVersionStat,
} from '../../api/aiEvaluation';

const { TextArea } = Input;

const INTENT_LABEL: Record<string, { color: string; label: string }> = {
  scam_detection: { color: 'red', label: '风险分析' },
  general_chat: { color: 'blue', label: '闲聊' },
  knowledge_query: { color: 'cyan', label: '反诈知识' },
  help_request: { color: 'orange', label: '紧急求助' },
};

export default function AiEvaluation() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: AiEvalSample[]; total: number }>({ items: [], total: 0 });
  const [stats, setStats] = useState<AiEvalVersionStat[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [promptVersion, setPromptVersion] = useState<string | undefined>();
  const [intent, setIntent] = useState<string | undefined>();
  const [scored, setScored] = useState<'yes' | 'no' | 'all'>('no');

  // 评分 Modal 状态
  const [scoringSample, setScoringSample] = useState<AiEvalSample | null>(null);
  const [tempScore, setTempScore] = useState(0);
  const [tempLabels, setTempLabels] = useState<string[]>([]);
  const [tempNotes, setTempNotes] = useState('');
  const [submittingScore, setSubmittingScore] = useState(false);

  // 详情查看 Modal
  const [viewing, setViewing] = useState<AiEvalSample | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        listAiEvalSamples({ promptVersion, intent, scored, page, pageSize }),
        getAiEvalStats(),
      ]);
      setData({ items: list.items, total: list.total });
      setStats(st);
    } catch (e: any) {
      message.error(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [promptVersion, intent, scored, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const openScoring = (sample: AiEvalSample) => {
    setScoringSample(sample);
    setTempScore(sample.adminScore ?? 0);
    setTempLabels(sample.adminLabel ? sample.adminLabel.split(',') : []);
    setTempNotes(sample.adminNotes ?? '');
  };

  const submitScore = async () => {
    if (!scoringSample) return;
    if (tempScore < 1) {
      message.warning('请先打 1-5 星');
      return;
    }
    setSubmittingScore(true);
    try {
      await scoreAiEvalSample(scoringSample.id, {
        score: tempScore,
        label: tempLabels.join(','),
        notes: tempNotes,
      });
      message.success('已保存');
      setScoringSample(null);
      load();
    } catch (e: any) {
      message.error(e?.message ?? '保存失败');
    } finally {
      setSubmittingScore(false);
    }
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (s: string) => new Date(s).toLocaleString().slice(5),
    },
    {
      title: '版本',
      dataIndex: 'promptVersion',
      key: 'promptVersion',
      width: 130,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '意图',
      dataIndex: 'intent',
      key: 'intent',
      width: 100,
      render: (i: string) => {
        const t = INTENT_LABEL[i] ?? { color: 'default', label: i ?? '-' };
        return <Tag color={t.color}>{t.label}</Tag>;
      },
    },
    {
      title: '用户输入',
      dataIndex: 'inputContent',
      key: 'inputContent',
      ellipsis: true,
      render: (s: string) => <span style={{ color: '#1F2D3D' }}>{s.slice(0, 80)}</span>,
    },
    {
      title: 'AI summary',
      key: 'summary',
      ellipsis: true,
      render: (_: unknown, r: AiEvalSample) => (
        <span style={{ color: '#666', fontSize: 13 }}>
          {(r.parsedResult?.summary ?? '').slice(0, 80)}
        </span>
      ),
    },
    {
      title: 'risk',
      key: 'risk',
      width: 100,
      render: (_: unknown, r: AiEvalSample) => {
        const level = r.parsedResult?.risk_level ?? '-';
        const conf = r.parsedResult?.confidence ?? '-';
        const colorMap: Record<string, string> = {
          high: 'red',
          medium: 'orange',
          low: 'blue',
          unknown: 'default',
        };
        return (
          <Space size={4}>
            <Tag color={colorMap[level] ?? 'default'}>{level}</Tag>
            <span style={{ fontSize: 12, color: '#888' }}>{conf}</span>
          </Space>
        );
      },
    },
    {
      title: '⭐',
      dataIndex: 'adminScore',
      key: 'adminScore',
      width: 110,
      render: (n: number | null) =>
        n ? <Rate value={n} disabled style={{ fontSize: 14 }} /> : <span style={{ color: '#bfbfbf' }}>未评</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, r: AiEvalSample) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => setViewing(r)}>
            详情
          </Button>
          <Button type="primary" size="small" ghost onClick={() => openScoring(r)}>
            {r.adminScore ? '改分' : '打分'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1F2D3D' }}>AI 分析评测中心</h2>

      {/* 统计卡 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {stats.length === 0 ? (
          <Col span={24}>
            <Card>
              <span style={{ color: '#888' }}>暂无样本。生产环境调用 AI 后 1-2 分钟内会自动落库。</span>
            </Card>
          </Col>
        ) : (
          stats.slice(0, 4).map((s) => (
            <Col span={6} key={s.promptVersion}>
              <Card>
                <Statistic
                  title={s.promptVersion}
                  value={s.avgScore?.toFixed(2) ?? '-'}
                  suffix={<span style={{ fontSize: 14, color: '#888' }}>⭐ / 5</span>}
                />
                <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                  已采样 {s.total}，已评分 {s.scored}
                </div>
              </Card>
            </Col>
          ))
        )}
      </Row>

      <Card>
        <Space style={{ marginBottom: 12 }} wrap>
          <Select
            placeholder="prompt 版本（全部）"
            style={{ width: 180 }}
            allowClear
            value={promptVersion}
            onChange={setPromptVersion}
            options={stats.map((s) => ({ label: s.promptVersion, value: s.promptVersion }))}
          />
          <Select
            placeholder="意图（全部）"
            style={{ width: 150 }}
            allowClear
            value={intent}
            onChange={setIntent}
            options={[
              { label: '风险分析', value: 'scam_detection' },
              { label: '闲聊', value: 'general_chat' },
              { label: '反诈知识', value: 'knowledge_query' },
              { label: '紧急求助', value: 'help_request' },
            ]}
          />
          <Select
            value={scored}
            style={{ width: 120 }}
            onChange={(v) => setScored(v)}
            options={[
              { label: '未评分', value: 'no' },
              { label: '已评分', value: 'yes' },
              { label: '全部', value: 'all' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={data.items}
          columns={columns}
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
          size="middle"
        />
      </Card>

      {/* 评分弹窗 */}
      <Modal
        title="评分这条样本"
        open={!!scoringSample}
        onCancel={() => setScoringSample(null)}
        onOk={submitScore}
        confirmLoading={submittingScore}
        okText="保存"
        width={680}
      >
        {scoringSample && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Card size="small">
              <div style={{ color: '#666', fontSize: 13, marginBottom: 6 }}>用户输入</div>
              <div>{scoringSample.inputContent}</div>
            </Card>
            <Card size="small">
              <div style={{ color: '#666', fontSize: 13, marginBottom: 6 }}>AI 结论</div>
              <div style={{ marginBottom: 6 }}>
                <Tag color="red">
                  {scoringSample.parsedResult?.risk_level} · {scoringSample.parsedResult?.confidence}
                </Tag>
              </div>
              <div style={{ marginBottom: 4 }}>{scoringSample.parsedResult?.summary}</div>
              {Array.isArray(scoringSample.parsedResult?.reasons) && (
                <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 13, color: '#555' }}>
                  {scoringSample.parsedResult.reasons.slice(0, 5).map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </Card>
            <div>
              <div style={{ marginBottom: 6 }}>打分（1-5 ⭐）</div>
              <Rate value={tempScore} onChange={setTempScore} />
              <span style={{ marginLeft: 12, color: '#888', fontSize: 13 }}>
                {tempScore >= 4 ? '👍 不错' : tempScore >= 2 ? '😐 一般' : tempScore >= 1 ? '👎 不行' : ''}
              </span>
            </div>
            <div>
              <div style={{ marginBottom: 6 }}>标签（多选）</div>
              <Select
                mode="tags"
                style={{ width: '100%' }}
                placeholder="选或填：准确 / 具体 / 安全 / 模板化 / 过度警觉 / 漏报 ..."
                value={tempLabels}
                onChange={setTempLabels}
                options={[
                  { label: '准确', value: '准确' },
                  { label: '具体', value: '具体' },
                  { label: '安全', value: '安全' },
                  { label: '模板化', value: '模板化' },
                  { label: '过度警觉', value: '过度警觉' },
                  { label: '漏报', value: '漏报' },
                ]}
              />
            </div>
            <div>
              <div style={{ marginBottom: 6 }}>备注（可选）</div>
              <TextArea
                rows={3}
                value={tempNotes}
                onChange={(e) => setTempNotes(e.target.value)}
                placeholder="比如：reasons 第 2 条不具体 / advice 过度催促..."
              />
            </div>
          </Space>
        )}
      </Modal>

      {/* 详情查看弹窗 */}
      <Modal
        title="样本详情"
        open={!!viewing}
        onCancel={() => setViewing(null)}
        footer={null}
        width={900}
      >
        {viewing && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Card size="small" title="System Prompt">
              <pre style={{ maxHeight: 240, overflow: 'auto', fontSize: 12, margin: 0 }}>
                {viewing.promptSnapshot?.system}
              </pre>
            </Card>
            <Card size="small" title="User Prompt">
              <pre style={{ maxHeight: 240, overflow: 'auto', fontSize: 12, margin: 0 }}>
                {viewing.promptSnapshot?.user}
              </pre>
            </Card>
            <Card size="small" title="AI 原始响应（raw）">
              <pre style={{ maxHeight: 240, overflow: 'auto', fontSize: 12, margin: 0 }}>
                {viewing.aiRawResponse}
              </pre>
            </Card>
            <Card size="small" title="结构化结果（parsed）">
              <pre style={{ maxHeight: 240, overflow: 'auto', fontSize: 12, margin: 0 }}>
                {JSON.stringify(viewing.parsedResult, null, 2)}
              </pre>
            </Card>
            <div style={{ color: '#888', fontSize: 13 }}>
              延迟 {viewing.latencyMs}ms · provider {viewing.modelProvider} · 用 tokens {viewing.tokensUsed ?? '-'}
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}
