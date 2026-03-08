import { useEffect, useState } from 'react';
import { Card, Table, Button, message, Select } from 'antd';
import { getSettings, updateSettings } from '../../api/settings';
import { getAiProviders, activateAiProvider, type AiProviderItem } from '../../api/ai';

export default function AIProviders() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<{ defaultProvider?: string; hasDoubaoKey?: boolean; hasOpenaiKey?: boolean; aiBaseUrl?: string | null }>({});
  const [providers, setProviders] = useState<AiProviderItem[]>([]);

  const load = () => {
    setLoading(true);
    Promise.all([getSettings(), getAiProviders()])
      .then(([s, p]) => {
        setSettings(s as any);
        setProviders((p as any).items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleActivate = (id: string) => {
    activateAiProvider(id)
      .then(() => {
        message.success('已切换');
        load();
      })
      .catch((e) => message.error(e?.message ?? '切换失败'));
  };

  const handleSaveDefault = (provider: string) => {
    updateSettings({ defaultProvider: provider })
      .then(() => {
        message.success('已保存');
        setSettings((s) => ({ ...s, defaultProvider: provider }));
      })
      .catch((e) => message.error(e?.message ?? '保存失败'));
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>AI 模型与 Key 管理</h2>
      <Card title="当前配置" loading={loading} style={{ marginBottom: 16 }}>
        <p>
          <strong>当前 AI Provider：</strong>{' '}
          <Select
            value={settings.defaultProvider ?? 'doubao'}
            style={{ width: 140 }}
            onChange={handleSaveDefault}
            options={[
              { label: 'doubao', value: 'doubao' },
              { label: 'openai', value: 'openai' },
              { label: 'other', value: 'other' },
            ]}
          />
        </p>
        <p style={{ color: '#5F6B7A' }}>
          Doubao Key：{settings.hasDoubaoKey ? '已配置' : '未配置'} | OpenAI Key：{settings.hasOpenaiKey ? '已配置' : '未配置'}
          {settings.aiBaseUrl && ` | Base URL: ${settings.aiBaseUrl}`}
        </p>
        <p style={{ color: '#5F6B7A', fontSize: 12 }}>
          Key 与 Base URL 请在「系统配置」中由 Superadmin 修改。
        </p>
      </Card>
      <Card title="Provider 列表（接口 /admin/ai/providers 未实现时为空）">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={providers}
          columns={[
            { title: 'provider', dataIndex: 'provider', key: 'provider' },
            { title: 'model_name', dataIndex: 'modelName', key: 'modelName' },
            { title: 'enabled', dataIndex: 'enabled', key: 'enabled', render: (v: boolean) => (v ? '是' : '否') },
            {
              title: '操作',
              key: 'action',
              render: (_: unknown, row: AiProviderItem) => (
                <Button type="link" size="small" onClick={() => handleActivate(row.id)}>
                  切换使用
                </Button>
              ),
            },
          ]}
          pagination={false}
        />
      </Card>
    </div>
  );
}
