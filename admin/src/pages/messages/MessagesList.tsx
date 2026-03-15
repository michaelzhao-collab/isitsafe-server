import { useEffect, useState } from 'react';
import { Table, Card, Button, Form, Input, message } from 'antd';
import { api } from '../../api/client';
import { SendOutlined } from '@ant-design/icons';

type MessageItem = { id: string; title: string; content: string; link: string | null; status: string; createdAt: string };

export default function MessagesList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: MessageItem[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .messages({ page, pageSize })
      .then((res) => setData({ items: res.items, total: res.total }))
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, pageSize]);

  const onSend = () => {
    form.validateFields().then((values) => {
      setSending(true);
      api
        .messagesCreate({ title: values.title, content: values.content, link: values.link || undefined })
        .then(() => {
          message.success('已发送，客户端将同步收到');
          form.resetFields();
          load();
        })
        .catch((e) => message.error(e?.message ?? '发送失败'))
        .finally(() => setSending(false));
    });
  };

  const setOffline = (id: string) => {
    api.messagesSetOffline(id).then(() => { message.success('已下架'); load(); }).catch((e) => message.error(e?.message ?? '操作失败'));
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true, width: 180 },
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true, render: (v: string) => (v && v.length > 50 ? v.slice(0, 50) + '...' : v) },
    { title: '跳转链接', dataIndex: 'link', key: 'link', ellipsis: true, width: 200, render: (v: string | null) => v || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => v === 'offline' ? '已下架' : '正常' },
    { title: '发布时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (v: string) => v?.slice(0, 19) },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: MessageItem) =>
        record.status === 'active' ? (
          <Button type="link" danger size="small" onClick={() => setOffline(record.id)}>下架</Button>
        ) : null,
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>消息管理</h2>
      <Card title="发送新消息（同步给所有客户端）" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical" onFinish={onSend}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="消息标题" maxLength={200} />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}>
            <Input.TextArea placeholder="消息内容" rows={3} />
          </Form.Item>
          <Form.Item name="link" label="跳转链接（选填）">
            <Input placeholder="https://..." maxLength={500} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={sending}>
              发送
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Card title="已发消息列表">
        <Table
          loading={loading}
          rowKey="id"
          columns={columns}
          dataSource={data.items}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps || 20);
            },
          }}
        />
      </Card>
    </div>
  );
}
