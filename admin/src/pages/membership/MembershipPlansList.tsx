import { useEffect, useState } from 'react';
import { Table, Card, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, Switch, message } from 'antd';
import { api, type MembershipPlanItem, type MembershipPlanCreate } from '../../api/client';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const PERIOD_OPTIONS = [
  { label: '周', value: 'weekly' },
  { label: '月', value: 'monthly' },
  { label: '年', value: 'yearly' },
];

export default function MembershipPlansList() {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<MembershipPlanItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<MembershipPlanCreate>();

  const load = () => {
    setLoading(true);
    api
      .membershipPlans()
      .then(setPlans)
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (row: MembershipPlanItem) => {
    setEditingId(row.id);
    form.setFieldsValue({
      name: row.name,
      productId: row.productId,
      price: row.price,
      currency: row.currency,
      period: row.period,
      description: row.description ?? undefined,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      isRecommended: row.isRecommended,
    });
    setModalOpen(true);
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const body: MembershipPlanCreate = {
        name: values.name,
        productId: values.productId,
        price: values.price,
        currency: values.currency ?? 'CNY',
        period: values.period,
        description: values.description,
        isActive: values.isActive ?? true,
        sortOrder: values.sortOrder ?? 0,
        isRecommended: values.isRecommended ?? false,
      };
      if (editingId) {
        api
          .membershipPlanUpdate(editingId, body)
          .then(() => {
            message.success('更新成功');
            setModalOpen(false);
            load();
          })
          .catch((e) => message.error(e?.message ?? '更新失败'));
      } else {
        api
          .membershipPlanCreate(body)
          .then(() => {
            message.success('新增成功');
            setModalOpen(false);
            load();
          })
          .catch((e) => message.error(e?.message ?? '新增失败'));
      }
    });
  };

  const handleDelete = (row: MembershipPlanItem) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除套餐「${row.name}」？`,
      onOk: () =>
        api
          .membershipPlanDelete(row.id)
          .then(() => {
            message.success('已删除');
            load();
          })
          .catch((e) => message.error(e?.message ?? '删除失败')),
    });
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 120 },
    { title: 'ProductID', dataIndex: 'productId', key: 'productId', width: 160, ellipsis: true },
    { title: '价格', dataIndex: 'price', key: 'price', width: 90, render: (v: number, r: MembershipPlanItem) => `${r.currency} ${v}` },
    { title: '周期', dataIndex: 'period', key: 'period', width: 80, render: (v: string) => ({ weekly: '周', monthly: '月', yearly: '年' }[v] ?? v) },
    { title: '推荐', dataIndex: 'isRecommended', key: 'isRecommended', width: 70, render: (v: boolean) => (v ? <Tag color="blue">推荐</Tag> : '-') },
    { title: '状态', dataIndex: 'isActive', key: 'isActive', width: 70, render: (v: boolean) => (v ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>) },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 70 },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, row: MembershipPlanItem) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(row)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>会员套餐管理</h2>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增套餐
          </Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={plans}
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>
      <Modal
        title={editingId ? '编辑套餐' : '新增套餐'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如：月度会员" />
          </Form.Item>
          <Form.Item name="productId" label="ProductID（Apple IAP）" rules={[{ required: true }]}>
            <Input placeholder="如：isitsafe_monthly" />
          </Form.Item>
          <Form.Item name="price" label="价格" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="currency" label="货币" initialValue="CNY">
            <Select options={[{ label: 'CNY', value: 'CNY' }, { label: 'USD', value: 'USD' }]} />
          </Form.Item>
          <Form.Item name="period" label="周期" rules={[{ required: true }]}>
            <Select options={PERIOD_OPTIONS} />
          </Form.Item>
          <Form.Item name="description" label="描述（选填）">
            <Input.TextArea rows={2} placeholder="套餐说明" />
          </Form.Item>
          <Form.Item name="isActive" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Form.Item name="isRecommended" label="推荐套餐" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序（数字越小越靠前）" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
