import { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Input, Modal, Form, message } from 'antd';
import { api } from '../api/client';

const categories = ['诈骗', '黑灰产', '老年人骗局', '投资/兼职/医疗风险'];

export default function KnowledgeManagement() {
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.knowledge({ page, pageSize });
      setData(res);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, pageSize]);

  const onAdd = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const onSubmit = async () => {
    const v = await form.validateFields();
    try {
      await api.knowledgeUpload(v);
      message.success('添加成功');
      setModalOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || '添加失败');
    }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '分类', dataIndex: 'category', key: 'category' },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, row: any) => (
        <Button
          size="small"
          type="link"
          danger
          onClick={async () => {
            if (!confirm('确定删除？')) return;
            try {
              await api.knowledgeDelete(row.id);
              message.success('已删除');
              load();
            } catch (e: any) {
              message.error(e?.message || '删除失败');
            }
          }}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <Card title="知识库管理">
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={onAdd}>
          新增
        </Button>
        <Button onClick={load} loading={loading}>
          刷新
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data.items}
        pagination={{
          current: page,
          pageSize,
          total: data.total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            if (typeof ps === 'number') setPageSize(ps);
          },
        }}
      />
      <Modal title="新增知识" open={modalOpen} onOk={onSubmit} onCancel={() => setModalOpen(false)} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Input placeholder={categories.join(' / ')} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
