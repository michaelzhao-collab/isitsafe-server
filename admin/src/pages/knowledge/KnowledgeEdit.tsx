import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, message } from 'antd';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import request from '../../api/request';
import { createKnowledge, updateKnowledge } from '../../api/knowledge';
import { api } from '../../api/client';

export default function KnowledgeEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(!!id && id !== 'new');
  const [categories, setCategories] = useState<Array<{ id: string; label: string }>>([]);

  const isNew = !id || id === 'new';

  useEffect(() => {
    api
      .knowledgeCategories()
      .then((res) => {
        const list = (res || []).filter((c: any) => c.status === 'active');
        setCategories(
          list.map((c: any) => ({
            id: c.key,
            label: `${c.key} / ${c.nameZh} / ${c.nameEn}`,
          }))
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id || id === 'new') {
      setFetchLoading(false);
      return;
    }
    const state = (location.state as { row?: Record<string, unknown> })?.row;
    if (state?.id) {
      form.setFieldsValue({
        title: state.title,
        category: state.category,
        content: state.content,
        tags: Array.isArray(state.tags) ? (state.tags as string[]).join(', ') : '',
        source: state.source,
        language: state.language || 'zh',
      });
      setFetchLoading(false);
      return;
    }
    setFetchLoading(true);
    request
      .get(`/admin/knowledge/${id}`)
      .then((item: any) => {
        if (item?.id) {
          form.setFieldsValue({
            title: item.title,
            category: item.category,
            content: item.content,
            tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
            source: item.source,
            language: item.language || 'zh',
          });
        }
      })
      .catch(() => {})
      .finally(() => setFetchLoading(false));
  }, [id, form, location.state]);

  const onFinish = (values: Record<string, unknown>) => {
    const tags = typeof values.tags === 'string' ? values.tags.split(/[,，\s]+/).filter(Boolean) : [];
    const payload = {
      title: values.title as string,
      category: values.category as string,
      content: values.content as string,
      tags,
      source: (values.source as string) || undefined,
      language: (values.language as string) || 'zh',
    };
    setLoading(true);
    (isNew ? createKnowledge(payload) : updateKnowledge(id!, payload))
      .then(() => {
        message.success(isNew ? '新增成功' : '保存成功');
        navigate('/knowledge');
      })
      .catch((e) => message.error(e?.message ?? '保存失败'))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>{isNew ? '新增知识' : '编辑知识'}</h2>
      <Card loading={fetchLoading}>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ language: ((location.state as any)?.language as string) || 'zh' }}>
          <Form.Item name="title" label="title" rules={[{ required: true }]}>
            <Input placeholder="标题" />
          </Form.Item>
          <Form.Item name="category" label="category" rules={[{ required: true }]}>
            <Select
              placeholder="选择分类"
              options={categories.map((c) => ({ label: c.label, value: c.id }))}
            />
          </Form.Item>
          <Form.Item name="content" label="content" rules={[{ required: true }]}>
            <Input.TextArea rows={6} placeholder="正文" />
          </Form.Item>
          <Form.Item name="tags" label="tags">
            <Input placeholder="逗号分隔" />
          </Form.Item>
          <Form.Item name="source" label="source">
            <Input placeholder="来源" />
          </Form.Item>
          <Form.Item name="language" label="language" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '中文 (zh)', value: 'zh' },
                { label: 'English (en)', value: 'en' },
              ]}
              style={{ width: 160 }}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate('/knowledge')}>
              取消
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
