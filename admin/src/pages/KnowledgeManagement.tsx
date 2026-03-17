import { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Input, Modal, Form, Tag, Switch, message } from 'antd';
import { api } from '../api/client';

interface CategoryItem {
  id: string;
  key: string;
  nameZh: string;
  nameEn: string;
  status: string;
  sortOrder: number;
  createdAt: string;
}

export default function KnowledgeManagement() {
  const [data, setData] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeOffline, setIncludeOffline] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.knowledgeCategories({ includeOffline });
      setData(res);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [includeOffline]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (item: CategoryItem) => {
    setEditing(item);
    form.setFieldsValue({
      key: item.key,
      nameZh: item.nameZh,
      nameEn: item.nameEn,
      sortOrder: item.sortOrder,
      status: item.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.updateKnowledgeCategory(editing.id, values);
        message.success('更新成功');
      } else {
        await api.createKnowledgeCategory(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    }
  };

  const handleToggleStatus = async (item: CategoryItem) => {
    const next = item.status === 'active' ? 'offline' : 'active';
    try {
      await api.updateKnowledgeCategoryStatus(item.id, next as 'active' | 'offline');
      message.success('状态已更新');
      load();
    } catch (e: any) {
      message.error(e?.message || '更新失败');
    }
  };

  const handleDelete = async (item: CategoryItem) => {
    if (!confirm('确定删除该分类？删除后将无法恢复，请确认没有使用中的数据。')) return;
    try {
      await api.deleteKnowledgeCategory(item.id);
      message.success('已删除');
      load();
    } catch (e: any) {
      message.error(e?.message || '删除失败');
    }
  };

  const columns = [
    { title: 'Key', dataIndex: 'key', key: 'key', width: 160 },
    { title: '中文名称', dataIndex: 'nameZh', key: 'nameZh' },
    { title: '英文名称', dataIndex: 'nameEn', key: 'nameEn' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: string) => (v === 'active' ? <Tag color="green">active</Tag> : <Tag>offline</Tag>),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 200,
      render: (v: string) => v?.slice(0, 19),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, row: CategoryItem) => (
        <Space>
          <Button size="small" type="link" onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Button
            size="small"
            type="link"
            onClick={() => handleToggleStatus(row)}
          >
            {row.status === 'active' ? '下架' : '上架'}
          </Button>
          <Button size="small" type="link" danger onClick={() => handleDelete(row)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="分类管理（知识库）">
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={openCreate}>
          新增分类
        </Button>
        <Button onClick={load} loading={loading}>
          刷新
        </Button>
        <span>
          显示下线分类：
          <Switch checked={includeOffline} onChange={setIncludeOffline} size="small" />
        </span>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data}
        pagination={false}
      />
      <Modal
        title={editing ? '编辑分类' : '新增分类'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="key"
            label="业务 Key（与后端 category 对应，英文/拼音，创建后不建议修改）"
            rules={[{ required: true, message: '请输入 key' }]}
          >
            <Input disabled={!!editing} placeholder="例如: phishing, investment_scam" />
          </Form.Item>
          <Form.Item
            name="nameZh"
            label="中文名称"
            rules={[{ required: true, message: '请输入中文名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="nameEn"
            label="英文名称"
            rules={[{ required: true, message: '请输入英文名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序（越小越靠前）">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Input placeholder="active / offline，不填则默认为 active" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
