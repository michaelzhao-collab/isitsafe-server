import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, message, Tag, Space, Divider } from 'antd';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { createAlert, updateAlert, aiRewriteIntel, type IntelAlert } from '../../api/intel';

const SEVERITY_OPTIONS = [
  { label: '紧急 urgent', value: 'urgent' },
  { label: '高 high', value: 'high' },
  { label: '普通 normal', value: 'normal' },
];

const STATUS_OPTIONS = [
  { label: '草稿 draft', value: 'draft' },
  { label: '待审 pending', value: 'pending' },
  { label: '已发布 published', value: 'published' },
  { label: '已归档 archived', value: 'archived' },
];

const CATEGORY_OPTIONS = [
  { label: '冒充客服 / 公检法', value: 'impersonation' },
  { label: '钓鱼链接 / 假 App', value: 'phishing' },
  { label: '投资理财', value: 'investment' },
  { label: '快递物流', value: 'package' },
  { label: '兼职刷单', value: 'job' },
  { label: '老年人专题', value: 'elder' },
  { label: '杀猪盘 / 网恋', value: 'romance' },
];

const REGION_PRESETS = ['*', 'CN', 'CN-11', 'CN-31', 'CN-44', 'US', 'US-CA', 'US-NY'];
const AUDIENCE_PRESETS = ['*', 'elder', 'student', 'finance', 'parent', 'overseas'];

interface ContentBlock {
  type: string;
  text: string;
}

export default function IntelEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [aiRewriting, setAiRewriting] = useState(false);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  const isNew = !id || id === 'new';

  useEffect(() => {
    const state = (location.state as { row?: IntelAlert; language?: string })?.row;
    if (state) {
      form.setFieldsValue({
        title: state.title,
        summary: state.summary,
        category: state.category,
        severity: state.severity,
        targetRegions: state.targetRegions ?? ['*'],
        targetAudiences: state.targetAudiences ?? ['*'],
        language: state.language,
        sourceUrl: state.sourceUrl ?? '',
        status: state.status,
      });
      if (Array.isArray(state.contentBlocks)) {
        const valid = (state.contentBlocks as any[]).filter(
          (b) => b && typeof b.type === 'string' && typeof b.text === 'string'
        );
        setBlocks(valid as ContentBlock[]);
      }
    } else if (isNew) {
      form.setFieldsValue({
        severity: 'normal',
        category: 'phishing',
        targetRegions: ['*'],
        targetAudiences: ['*'],
        language: (location.state as { language?: string })?.language || 'zh',
        status: 'draft',
      });
    }
  }, [id, form, location.state, isNew]);

  const onFinish = (values: any) => {
    setLoading(true);
    const payload = {
      title: values.title as string,
      summary: values.summary as string,
      contentBlocks: blocks.length > 0 ? blocks : undefined,
      category: values.category as string,
      severity: values.severity as 'normal' | 'high' | 'urgent',
      targetRegions: (values.targetRegions as string[]) ?? ['*'],
      targetAudiences: (values.targetAudiences as string[]) ?? ['*'],
      language: (values.language as string) ?? 'zh',
      sourceUrl: (values.sourceUrl as string) || undefined,
      status: values.status as 'draft' | 'pending' | 'published' | 'archived',
    };
    if (!payload.title?.trim() || !payload.summary?.trim()) {
      message.error('请填写标题和摘要');
      setLoading(false);
      return;
    }
    const promise = isNew ? createAlert(payload) : updateAlert(id!, payload);
    promise
      .then(() => {
        message.success(isNew ? '新增成功' : '保存成功');
        navigate('/intel');
      })
      .catch((e) => message.error(e?.message ?? '保存失败'))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>{isNew ? '新增情报' : '编辑情报'}</h2>
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写标题' }]}>
            <Input placeholder="海淀区'假医保退费'骗局 24h 新增 7 起" maxLength={200} />
          </Form.Item>
          <Form.Item name="summary" label="摘要（首页通知条 + 列表预览用）" rules={[{ required: true, message: '请填写摘要' }]}>
            <Input.TextArea rows={4} placeholder="一句话概括套路 + 防范建议" />
          </Form.Item>

          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item name="severity" label="严重度" rules={[{ required: true }]}>
            <Select options={SEVERITY_OPTIONS} />
          </Form.Item>

          <Form.Item name="targetRegions" label="目标地区（多选）" tooltip="ISO 3166-2，'*' 表示全球">
            <Select mode="tags" placeholder="选择或输入地区" tokenSeparators={[',']}>
              {REGION_PRESETS.map((r) => (
                <Select.Option key={r} value={r}>
                  {r}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="targetAudiences" label="目标受众（多选）" tooltip="'*' 表示全部受众">
            <Select mode="tags" placeholder="选择或输入受众" tokenSeparators={[',']}>
              {AUDIENCE_PRESETS.map((a) => (
                <Select.Option key={a} value={a}>
                  {a}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="language" label="语言" rules={[{ required: true }]}>
            <Select
              style={{ width: 180 }}
              options={[
                { label: '中文 (zh)', value: 'zh' },
                { label: 'English (en)', value: 'en' },
              ]}
            />
          </Form.Item>
          <Form.Item name="sourceUrl" label="信息来源 URL（可选）">
            <Input placeholder="https://weibo.com/..." />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={STATUS_OPTIONS} style={{ width: 200 }} />
          </Form.Item>

          <Divider>结构化内容（套路 3 步 + 防范建议）</Divider>
          <BlocksEditor blocks={blocks} onChange={setBlocks} />

          <div style={{ marginTop: 16, padding: 12, background: '#F5F7FA', borderRadius: 6 }}>
            <Space>
              <Button
                loading={aiRewriting}
                onClick={async () => {
                  const title = form.getFieldValue('title') as string;
                  const summary = form.getFieldValue('summary') as string;
                  const language = (form.getFieldValue('language') as string) || 'zh';
                  if (!title?.trim() && !summary?.trim()) {
                    message.warning('先填写标题或摘要再让 AI 改写');
                    return;
                  }
                  setAiRewriting(true);
                  try {
                    // request interceptor 已经 unwrap res.data；TS 类型不准，用 unknown 中转
                    const r = (await aiRewriteIntel({ title, summary, language })) as unknown as {
                      summary: string;
                      contentBlocks: ContentBlock[];
                      provider?: string;
                    };
                    if (r.summary) form.setFieldsValue({ summary: r.summary });
                    if (Array.isArray(r.contentBlocks) && r.contentBlocks.length > 0) {
                      setBlocks(r.contentBlocks);
                    } else {
                      message.warning('AI 未返回结构化块，仅更新了摘要');
                    }
                    message.success(`AI 改写完成${r.provider ? `（${r.provider}）` : ''}`);
                  } catch (e: any) {
                    message.error(e?.message ?? 'AI 改写失败');
                  } finally {
                    setAiRewriting(false);
                  }
                }}
              >
                ✨ AI 改写（套路 3 步 + 防范建议）
              </Button>
              <span style={{ fontSize: 12, color: '#8492A6' }}>
                基于标题 + 摘要调 AI 输出结构化内容；编辑者可二次修改后保存
              </span>
            </Space>
          </div>

          <Form.Item style={{ marginTop: 24 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存
              </Button>
              <Button onClick={() => navigate('/intel')}>取消</Button>
            </Space>
            <Tag color="processing" style={{ marginLeft: 16 }}>
              提示：状态切到 published 时自动设置 publishedAt
            </Tag>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

const BLOCK_TYPE_OPTIONS = [
  { label: '骗子套路 (step)', value: 'step' },
  { label: '防范建议 (tip)', value: 'tip' },
  { label: '配图/截图说明 (image)', value: 'image' },
  { label: '小结 (summary)', value: 'summary' },
];

interface BlocksEditorProps {
  blocks: ContentBlock[];
  onChange: (next: ContentBlock[]) => void;
}

function BlocksEditor({ blocks, onChange }: BlocksEditorProps) {
  return (
    <div>
      {blocks.map((b, idx) => (
        <Card
          key={idx}
          size="small"
          style={{ marginBottom: 8, background: '#FAFBFC' }}
          title={
            <Space size={8}>
              <Select
                value={b.type}
                style={{ width: 200 }}
                size="small"
                onChange={(v) => {
                  const next = blocks.slice();
                  next[idx] = { ...next[idx], type: v };
                  onChange(next);
                }}
                options={BLOCK_TYPE_OPTIONS}
              />
              <span style={{ color: '#8492A6', fontSize: 12 }}>第 {idx + 1} 块</span>
            </Space>
          }
          extra={
            <Space>
              <Button
                size="small"
                disabled={idx === 0}
                onClick={() => {
                  const next = blocks.slice();
                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                  onChange(next);
                }}
              >
                上移
              </Button>
              <Button
                size="small"
                disabled={idx === blocks.length - 1}
                onClick={() => {
                  const next = blocks.slice();
                  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                  onChange(next);
                }}
              >
                下移
              </Button>
              <Button
                size="small"
                danger
                onClick={() => onChange(blocks.filter((_, i) => i !== idx))}
              >
                删除
              </Button>
            </Space>
          }
        >
          <Input.TextArea
            value={b.text}
            rows={3}
            maxLength={800}
            showCount
            onChange={(e) => {
              const next = blocks.slice();
              next[idx] = { ...next[idx], text: e.target.value };
              onChange(next);
            }}
          />
        </Card>
      ))}
      <Button
        type="dashed"
        block
        onClick={() => onChange([...blocks, { type: 'step', text: '' }])}
      >
        + 添加一块
      </Button>
    </div>
  );
}
