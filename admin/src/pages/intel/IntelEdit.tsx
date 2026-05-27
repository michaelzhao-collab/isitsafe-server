import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, message, Tag, Space } from 'antd';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { createAlert, updateAlert, type IntelAlert } from '../../api/intel';

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

export default function IntelEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

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

          <Form.Item>
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
