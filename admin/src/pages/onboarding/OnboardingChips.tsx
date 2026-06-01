/**
 * V4-P1 冷启动引导 chips 管理
 *
 * iOS 首次进入聊天页时会拉取本页配置的 chips 展示
 * tap chip → 按 actionType 分发：
 *   text   → 文案填入输入框 + 自动发送
 *   image  → 打开相册
 *   camera → 打开摄像头
 *   voice  → 切到语音模式
 *   url    → 跳转内部页面
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  listOnboardingChips,
  createOnboardingChip,
  updateOnboardingChip,
  deleteOnboardingChip,
  type OnboardingChip,
} from '../../api/onboardingChips';

const ACTION_TYPES = [
  { label: '文字 (自动发送)', value: 'text' },
  { label: '相册', value: 'image' },
  { label: '相机', value: 'camera' },
  { label: '语音', value: 'voice' },
  { label: '内部跳转 (家庭/情报/会员)', value: 'url' },
];

const ICON_OPTIONS = [
  { label: '💬 message.fill', value: 'message.fill' },
  { label: '🛡️ shield.lefthalf.filled', value: 'shield.lefthalf.filled' },
  { label: '📊 chart.line.uptrend.xyaxis', value: 'chart.line.uptrend.xyaxis' },
  { label: '📸 camera.fill', value: 'camera.fill' },
  { label: '🎤 mic.fill', value: 'mic.fill' },
  { label: '🔗 link', value: 'link' },
  { label: '⚠️ exclamationmark.triangle.fill', value: 'exclamationmark.triangle.fill' },
  { label: '📞 phone.fill', value: 'phone.fill' },
  { label: '🏠 house.fill', value: 'house.fill' },
  { label: '📰 newspaper.fill', value: 'newspaper.fill' },
];

export default function OnboardingChips() {
  const [list, setList] = useState<OnboardingChip[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<OnboardingChip | null>(null);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listOnboardingChips();
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      message.error(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (row: OnboardingChip) => {
    setEditing(row);
    setCreating(false);
    form.setFieldsValue({
      orderIdx: row.orderIdx,
      labelZh: row.labelZh,
      labelEn: row.labelEn,
      iconType: row.iconType,
      actionType: row.actionType,
      actionPayloadZh: row.actionPayloadZh ?? '',
      actionPayloadEn: row.actionPayloadEn ?? '',
      status: row.status,
    });
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    form.setFieldsValue({
      orderIdx: list.length + 1,
      labelZh: '',
      labelEn: '',
      iconType: 'message.fill',
      actionType: 'text',
      actionPayloadZh: '',
      actionPayloadEn: '',
      status: 'active',
    });
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        orderIdx: values.orderIdx ?? 0,
        labelZh: values.labelZh,
        labelEn: values.labelEn,
        iconType: values.iconType,
        actionType: values.actionType,
        actionPayloadZh: values.actionPayloadZh || null,
        actionPayloadEn: values.actionPayloadEn || null,
        status: values.status ?? 'active',
      };
      if (editing) {
        await updateOnboardingChip(editing.id, payload);
        message.success('已保存');
      } else {
        await createOnboardingChip(payload);
        message.success('已创建');
      }
      setEditing(null);
      setCreating(false);
      load();
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验
      message.error(e?.message ?? '保存失败');
    }
  };

  const toggleStatus = async (row: OnboardingChip) => {
    try {
      await updateOnboardingChip(row.id, {
        status: row.status === 'active' ? 'archived' : 'active',
      });
      message.success(row.status === 'active' ? '已下架' : '已上架');
      load();
    } catch (e: any) {
      message.error(e?.message ?? '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOnboardingChip(id);
      message.success('已删除');
      load();
    } catch (e: any) {
      message.error(e?.message ?? '删除失败');
    }
  };

  const columns = [
    { title: '排序', dataIndex: 'orderIdx', key: 'orderIdx', width: 70 },
    { title: '中文', dataIndex: 'labelZh', key: 'labelZh' },
    { title: '英文', dataIndex: 'labelEn', key: 'labelEn' },
    { title: '图标', dataIndex: 'iconType', key: 'iconType', width: 180 },
    {
      title: '行为',
      dataIndex: 'actionType',
      key: 'actionType',
      width: 130,
      render: (t: string) => {
        const o = ACTION_TYPES.find((x) => x.value === t);
        return <Tag>{o?.label ?? t}</Tag>;
      },
    },
    {
      title: '发送文本',
      key: 'payload',
      ellipsis: true,
      render: (_: unknown, r: OnboardingChip) => r.actionPayloadZh ?? '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) =>
        s === 'active' ? <Tag color="green">上架</Tag> : <Tag>已下架</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, r: OnboardingChip) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Button type="link" size="small" onClick={() => toggleStatus(r)}>
            {r.status === 'active' ? '下架' : '上架'}
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1F2D3D' }}>冷启动引导 chips</h2>
      <Card>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ color: '#888', fontSize: 13 }}>
            iOS 首次进入聊天页拉取本配置展示。改后 iOS 24h 内热更，强刷可立即生效。
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增 chip</Button>
        </div>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          columns={columns}
          pagination={false}
          size="middle"
        />
      </Card>

      <Modal
        title={editing ? '编辑 chip' : '新增 chip'}
        open={!!editing || creating}
        onCancel={() => { setEditing(null); setCreating(false); }}
        onOk={submit}
        okText="保存"
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="orderIdx" label="排序（数字小的在前）" rules={[{ required: true }]}>
            <InputNumber min={0} max={9999} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="labelZh" label="中文标签" rules={[{ required: true, max: 80 }]}>
            <Input placeholder="例：派出所打电话查我银行卡，是真的吗？" />
          </Form.Item>
          <Form.Item name="labelEn" label="英文标签" rules={[{ required: true, max: 120 }]}>
            <Input placeholder="e.g. Police calling about my bank card, is it real?" />
          </Form.Item>
          <Form.Item name="iconType" label="图标（SF Symbol）" rules={[{ required: true }]}>
            <Select options={ICON_OPTIONS} showSearch />
          </Form.Item>
          <Form.Item name="actionType" label="点击行为" rules={[{ required: true }]}>
            <Select options={ACTION_TYPES} />
          </Form.Item>
          <Form.Item
            name="actionPayloadZh"
            label="中文发送文本（仅 text/url 用，其他留空）"
            tooltip="text → 自动填入输入框并发送；url → 内部跳转路径（如 family / intel / premium）"
          >
            <Input.TextArea rows={2} placeholder="可与标签相同。url 类型填 family / intel / premium 等" />
          </Form.Item>
          <Form.Item name="actionPayloadEn" label="英文发送文本（仅 text/url 用）">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '上架', value: 'active' },
                { label: '下架', value: 'archived' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
