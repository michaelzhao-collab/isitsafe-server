import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, message, Upload, Tabs, Image } from 'antd';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { UploadOutlined } from '@ant-design/icons';
import request from '../../api/request';
import { createKnowledge, updateKnowledge, uploadArticleImage } from '../../api/knowledge';
import { api } from '../../api/client';
import ArticleEditor from '../../components/ArticleEditor';

export default function KnowledgeEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(!!id && id !== 'new');
  const [categories, setCategories] = useState<Array<{ id: string; label: string }>>([]);
  // 文章正文 TipTap JSON；为空时落库 contentBlocks=null，iOS 自动降级到纯文本 content
  const [contentBlocks, setContentBlocks] = useState<unknown | null>(null);
  // 封面图 R2 URL
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  // 编辑模式：article（富文本）/ legacy（纯文本，兼容旧数据 + 短摘要场景）
  const [mode, setMode] = useState<'article' | 'legacy'>('article');

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
    const populate = (item: any) => {
      form.setFieldsValue({
        title: item.title,
        category: item.category,
        content: item.content,
        tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
        source: item.source,
        language: item.language || 'zh',
      });
      if (item.contentBlocks) {
        setContentBlocks(item.contentBlocks);
        setMode('article');
      } else {
        setContentBlocks(null);
        setMode(item.content ? 'legacy' : 'article');
      }
      setCoverImage(item.coverImage ?? null);
    };

    if (!id || id === 'new') {
      setFetchLoading(false);
      return;
    }
    const state = (location.state as { row?: Record<string, unknown> })?.row;
    if (state?.id) {
      populate(state);
      setFetchLoading(false);
      return;
    }
    setFetchLoading(true);
    request
      .get(`/admin/knowledge/${id}`)
      .then((item: any) => {
        if (item?.id) populate(item);
      })
      .catch(() => {})
      .finally(() => setFetchLoading(false));
  }, [id, form, location.state]);

  const onFinish = (values: Record<string, unknown>) => {
    const tags = typeof values.tags === 'string' ? values.tags.split(/[,，\s]+/).filter(Boolean) : [];
    // 决定提交字段：富文本模式提交 contentBlocks，content 留空让服务端从 blocks 派生；
    //              纯文本模式提交 content，blocks 置 null 以清除旧 blocks（编辑回退场景）
    const isArticleMode = mode === 'article' && contentBlocks && hasContent(contentBlocks);
    const payload: any = {
      title: values.title as string,
      category: values.category as string,
      content: isArticleMode ? '' : (values.content as string) || '',
      tags,
      source: (values.source as string) || undefined,
      language: (values.language as string) || 'zh',
      contentBlocks: isArticleMode ? contentBlocks : null,
      coverImage: coverImage,
    };
    if (!payload.title?.trim()) {
      message.error('请填写标题');
      return;
    }
    if (!payload.category) {
      message.error('请选择分类');
      return;
    }
    if (!isArticleMode && !payload.content?.trim()) {
      message.error('请填写正文内容');
      return;
    }
    setLoading(true);
    (isNew ? createKnowledge(payload) : updateKnowledge(id!, payload))
      .then(() => {
        message.success(isNew ? '新增成功' : '保存成功');
        navigate('/knowledge');
      })
      .catch((e) => message.error(e?.message ?? '保存失败'))
      .finally(() => setLoading(false));
  };

  const handleCoverUpload = async (file: File): Promise<boolean> => {
    setCoverUploading(true);
    try {
      const url = await uploadArticleImage(file, 'case');
      setCoverImage(url);
      message.success('封面图上传成功');
    } catch (e: any) {
      message.error(e?.message ?? '封面图上传失败');
    } finally {
      setCoverUploading(false);
    }
    return false; // 阻止 antd 自带的 XHR
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>{isNew ? '新增知识' : '编辑知识'}</h2>
      <Card loading={fetchLoading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ language: ((location.state as any)?.language as string) || 'zh' }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写标题' }]}>
            <Input placeholder="标题" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select
              placeholder="选择分类"
              options={categories.map((c) => ({ label: c.label, value: c.id }))}
            />
          </Form.Item>

          <Form.Item label="封面图（可选，列表与详情顶部展示）">
            {coverImage ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Image src={coverImage} width={160} height={100} style={{ objectFit: 'cover', borderRadius: 6 }} />
                <Button danger size="small" onClick={() => setCoverImage(null)}>移除封面</Button>
              </div>
            ) : (
              <Upload accept="image/*" showUploadList={false} beforeUpload={handleCoverUpload}>
                <Button icon={<UploadOutlined />} loading={coverUploading}>
                  上传封面图
                </Button>
              </Upload>
            )}
          </Form.Item>

          <Form.Item label="正文" required>
            <Tabs
              activeKey={mode}
              onChange={(k) => setMode(k as 'article' | 'legacy')}
              items={[
                {
                  key: 'article',
                  label: '富文本（推荐，支持图文）',
                  children: (
                    <div>
                      <ArticleEditor
                        value={contentBlocks}
                        onChange={setContentBlocks}
                        placeholder="在这里粘贴文章内容，包括图片…&#10;从网页/Word 复制粘贴时，图片会自动上传到 R2。"
                      />
                      <div style={{ marginTop: 6, color: '#8c8c8c', fontSize: 12 }}>
                        提示：直接粘贴（或拖拽）图片会自动上传到 R2；外站图片粘贴后也会异步重新上传（部分网站有防盗链可能上传失败，会保留原链接）。
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'legacy',
                  label: '纯文本（兼容旧数据）',
                  children: (
                    <Form.Item name="content" noStyle>
                      <Input.TextArea rows={8} placeholder="纯文本正文" />
                    </Form.Item>
                  ),
                },
              ]}
            />
          </Form.Item>

          <Form.Item name="tags" label="标签">
            <Input placeholder="逗号分隔" />
          </Form.Item>
          <Form.Item name="source" label="来源">
            <Input placeholder="来源 URL 或出处" />
          </Form.Item>
          <Form.Item name="language" label="语言" rules={[{ required: true }]}>
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

/** 判断 TipTap JSON 是否有实质内容（不只是空 doc） */
function hasContent(blocks: unknown): boolean {
  const json = blocks as any;
  if (!json?.content || !Array.isArray(json.content)) return false;
  // 递归找任意有 text 的节点或 image
  const walk = (nodes: any[]): boolean => {
    for (const n of nodes) {
      if (n?.type === 'image' && n.attrs?.src) return true;
      if (typeof n?.text === 'string' && n.text.trim().length > 0) return true;
      if (Array.isArray(n?.content) && walk(n.content)) return true;
    }
    return false;
  };
  return walk(json.content);
}
