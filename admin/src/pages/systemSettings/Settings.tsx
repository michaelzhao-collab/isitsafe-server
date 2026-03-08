import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, message } from 'antd';
import { getSettings, updateSettings, type SystemSettingsRes } from '../../api/settings';

export default function Settings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then((res) => {
        const data = res as unknown as SystemSettingsRes;
        form.setFieldsValue({
          defaultProvider: data.defaultProvider ?? 'doubao',
          aiBaseUrl: data.aiBaseUrl ?? '',
          doubaoKey: '', // 脱敏不返回，仅用于更新
          openaiKey: '',
        });
      })
      .catch(() => message.error('获取配置失败'))
      .finally(() => setFetchLoading(false));
  }, [form]);

  const onFinish = (values: Record<string, string>) => {
    setLoading(true);
    updateSettings({
      defaultProvider: values.defaultProvider || undefined,
      aiBaseUrl: values.aiBaseUrl || null,
      doubaoKey: values.doubaoKey || undefined,
      openaiKey: values.openaiKey || undefined,
    })
      .then(() => message.success('保存成功（仅 Superadmin 可生效）'))
      .catch((e) => message.error(e?.message ?? '保存失败'))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>系统配置</h2>
      <Card loading={fetchLoading}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="defaultProvider" label="AI_PROVIDER">
            <Select
              options={[
                { label: 'doubao', value: 'doubao' },
                { label: 'openai', value: 'openai' },
                { label: 'other', value: 'other' },
              ]}
            />
          </Form.Item>
          <Form.Item name="aiBaseUrl" label="AI Base URL">
            <Input placeholder="可选，自定义 API 地址" />
          </Form.Item>
          <Form.Item name="doubaoKey" label="Doubao API Key">
            <Input.Password placeholder="留空则不修改" />
          </Form.Item>
          <Form.Item name="openaiKey" label="OpenAI API Key">
            <Input.Password placeholder="留空则不修改" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存
            </Button>
          </Form.Item>
        </Form>
        <p style={{ color: '#5F6B7A', fontSize: 12 }}>
          其他项（如 CACHE_TTL、MAX_AI_REQUEST_PER_MIN、MAX_QUERY_LENGTH）可由后端扩展 PUT /admin/settings 支持。
        </p>
      </Card>
    </div>
  );
}
