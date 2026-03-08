import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import request from '../../api/request';
import { createRiskData, updateRiskData, type RiskType } from '../../api/risk';

const riskTypes: RiskType[] = ['phone', 'url', 'company', 'wallet', 'keyword'];

export default function RiskEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(!!id);

  const isNew = !id || id === 'new';

  useEffect(() => {
    if (!id || id === 'new') return;
    setFetchLoading(true);
    request
      .get(`/admin/risk-data/${id}`)
      .then((res: any) => {
        form.setFieldsValue({
          type: res.type,
          content: res.content,
          riskLevel: res.riskLevel,
          riskCategory: res.riskCategory,
          source: res.source,
          tags: Array.isArray(res.tags) ? res.tags.join(', ') : res.tags,
        });
      })
      .catch(() => message.error('接口未实现或数据不存在'))
      .finally(() => setFetchLoading(false));
  }, [id, form]);

  const onFinish = (values: Record<string, unknown>) => {
    const tags = typeof values.tags === 'string' ? values.tags.split(/[,，\s]+/).filter(Boolean) : [];
    const payload = {
      type: values.type,
      content: values.content,
      riskLevel: values.riskLevel,
      riskCategory: values.riskCategory || null,
      source: values.source || null,
      tags,
    };
    setLoading(true);
    (isNew ? createRiskData(payload) : updateRiskData(id!, payload))
      .then(() => {
        message.success(isNew ? '新增成功' : '保存成功');
        navigate('/risk-database');
      })
      .catch((e) => message.error(e?.message ?? '保存失败'))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>{isNew ? '新增风险数据' : '编辑风险数据'}</h2>
      <Card loading={fetchLoading}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="type" label="type" rules={[{ required: true }]}>
            <Select placeholder="选择类型" options={riskTypes.map((t) => ({ label: t, value: t }))} />
          </Form.Item>
          <Form.Item name="content" label="content" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="内容" />
          </Form.Item>
          <Form.Item name="riskLevel" label="risk_level" rules={[{ required: true }]}>
            <Select
              placeholder="风险等级"
              options={[
                { label: 'high', value: 'high' },
                { label: 'medium', value: 'medium' },
                { label: 'low', value: 'low' },
              ]}
            />
          </Form.Item>
          <Form.Item name="riskCategory" label="risk_category">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="source" label="source">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="tags" label="tags">
            <Input placeholder="逗号分隔" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate('/risk-database')}>
              取消
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
