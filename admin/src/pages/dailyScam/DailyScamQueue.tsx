import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Select, message, Popconfirm, Modal, Form, Input, DatePicker,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  listDailyScam,
  createDailyScam,
  updateDailyScam,
  reviewDailyScam,
  sendDailyScamNow,
  deleteDailyScam,
  type DailyScamCandidate,
} from '../../api/dailyScam';

const STATUS_COLORS: Record<string, string> = {
  pending: 'gold',
  approved: 'blue',
  rejected: 'red',
  sent: 'green',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '待审',
  approved: '已批·待发',
  rejected: '已驳回',
  sent: '已发送',
};
const RISK_COLORS: Record<string, string> = { high: 'red', medium: 'orange', low: 'green' };

interface FormValues {
  title: string;
  summary: string;
  riskLevel: string;
  deepLink?: string;
  scheduledDate: Dayjs;
}

export default function DailyScamQueue() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ items: DailyScamCandidate[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState<DailyScamCandidate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const load = () => {
    setLoading(true);
    listDailyScam({ status, page, pageSize })
      .then((r) => setData({ items: r.items, total: r.total }))
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ riskLevel: 'high', scheduledDate: dayjs().add(1, 'day') } as Partial<FormValues>);
    setModalOpen(true);
  };

  const openEdit = (row: DailyScamCandidate) => {
    setEditing(row);
    form.setFieldsValue({
      title: row.title,
      summary: row.summary,
      riskLevel: row.riskLevel,
      deepLink: row.deepLink ?? undefined,
      scheduledDate: dayjs(row.scheduledDate),
    });
    setModalOpen(true);
  };

  const submit = async () => {
    const v = await form.validateFields();
    const body = {
      title: v.title,
      summary: v.summary,
      riskLevel: v.riskLevel,
      deepLink: v.deepLink || null,
      scheduledDate: v.scheduledDate.format('YYYY-MM-DD'),
    };
    try {
      if (editing) await updateDailyScam(editing.id, body);
      else await createDailyScam(body);
      message.success('已保存');
      setModalOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.message ?? '保存失败');
    }
  };

  const doReview = (id: string, action: 'approve' | 'reject') => {
    reviewDailyScam(id, action)
      .then(() => { message.success('已处理'); load(); })
      .catch((e) => message.error(e?.message ?? '操作失败'));
  };

  const doSendNow = (id: string) => {
    sendDailyScamNow(id)
      .then((r) => { message.success(`已发送至 ${r.groups} 个家庭群`); load(); })
      .catch((e) => message.error(e?.message ?? '发送失败'));
  };

  const doDelete = (id: string) => {
    deleteDailyScam(id)
      .then(() => { message.success('已删除'); load(); })
      .catch((e) => message.error(e?.message ?? '删除失败'));
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true, width: 220 },
    { title: '摘要', dataIndex: 'summary', key: 'summary', ellipsis: true },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 80,
      render: (r: string) => <Tag color={RISK_COLORS[r] ?? 'default'}>{r}</Tag>,
    },
    {
      title: '计划发送日',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      width: 120,
      render: (v: string) => v?.slice(0, 10),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string, row: DailyScamCandidate) => (
        <Space direction="vertical" size={0}>
          <Tag color={STATUS_COLORS[s] ?? 'default'}>{STATUS_LABEL[s] ?? s}</Tag>
          {s === 'sent' && row.sentGroupCount != null && (
            <span style={{ fontSize: 11, color: '#999' }}>{row.sentGroupCount} 群</span>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      fixed: 'right' as const,
      render: (_: unknown, row: DailyScamCandidate) => (
        <Space wrap>
          {row.status !== 'sent' && (
            <Button type="link" size="small" onClick={() => openEdit(row)}>编辑</Button>
          )}
          {row.status === 'pending' && (
            <>
              <Popconfirm title="批准这条？批准后到期即自动发送" onConfirm={() => doReview(row.id, 'approve')}>
                <Button type="link" size="small" style={{ color: '#16a34a' }}>通过</Button>
              </Popconfirm>
              <Popconfirm title="驳回？" onConfirm={() => doReview(row.id, 'reject')}>
                <Button type="link" size="small" danger>驳回</Button>
              </Popconfirm>
            </>
          )}
          {row.status === 'approved' && (
            <Popconfirm title="立即发送到所有家庭群？（不等 18:00）" onConfirm={() => doSendNow(row.id)}>
              <Button type="link" size="small">立即发送</Button>
            </Popconfirm>
          )}
          {row.status !== 'sent' && (
            <Popconfirm title="删除这条候选？" onConfirm={() => doDelete(row.id)}>
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: '#1F2D3D' }}>每日一骗 · 明日一骗队列</h2>
        <Button type="primary" onClick={openCreate}>新建候选</Button>
      </div>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 160 }}
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            allowClear
            placeholder="状态筛选"
            options={[
              { label: '待审 pending', value: 'pending' },
              { label: '已批·待发 approved', value: 'approved' },
              { label: '已驳回 rejected', value: 'rejected' },
              { label: '已发送 sent', value: 'sent' },
            ]}
          />
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
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); if (ps) setPageSize(ps); },
          }}
          scroll={{ x: 1100 }}
        />
      </Card>
      <Modal
        open={modalOpen}
        title={editing ? '编辑候选' : '新建每日一骗候选'}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input maxLength={200} placeholder="如：冒充公检法要求转账到“安全账户”" />
          </Form.Item>
          <Form.Item name="summary" label="摘要（进群卡片正文，≤3 行）" rules={[{ required: true, message: '请输入摘要' }]}>
            <Input.TextArea rows={4} placeholder="用一两句话讲清套路和防范要点" />
          </Form.Item>
          <Form.Item name="riskLevel" label="风险等级" rules={[{ required: true }]}>
            <Select options={[
              { label: '高风险 high', value: 'high' },
              { label: '中风险 medium', value: 'medium' },
              { label: '低风险 low', value: 'low' },
            ]} />
          </Form.Item>
          <Form.Item name="scheduledDate" label="计划发送日" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="deepLink" label="跳转链接（可选，点击卡片进详情）">
            <Input placeholder="starlens 内部路由，可留空" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
