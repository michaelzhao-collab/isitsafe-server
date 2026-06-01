/**
 * V4-P2 推送通知管理
 *
 * 三块：
 *  1. 顶部表单：标题 / 内容 / 受众（全部用户 OR 指定用户）/ 用户选择器
 *     - 选完受众/用户立刻调 preview-audience，展示"将命中 N 台设备 (M 个用户)"
 *  2. 发送按钮：调 /admin/push/send，回执显示投递数/失败数/错误摘要
 *  3. 历史记录表：分页，最近 20 条 / 页
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card,
  Form,
  Input,
  Radio,
  Select,
  Button,
  Table,
  Space,
  Tag,
  message,
  Spin,
  Alert,
  Tooltip,
} from 'antd';
import { SendOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../api/client';

type Audience = 'all' | 'user';

interface UserLite {
  id: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
}

function displayUser(u: UserLite | null | undefined): string {
  if (!u) return '-';
  const tag = u.nickname || u.phone || u.email || u.id;
  return `${tag} (${u.id.slice(0, 8)}...)`;
}

export default function PushNotifications() {
  const [form] = Form.useForm();
  const [audience, setAudience] = useState<Audience>('all');
  const [targetUserId, setTargetUserId] = useState<string | undefined>(undefined);
  const [audienceStats, setAudienceStats] = useState<{
    usersCount: number;
    devicesCount: number;
    user?: UserLite | null;
  } | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // 用户搜索（指定单用户时）
  const [userSearchResults, setUserSearchResults] = useState<UserLite[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  // 初次拉取一页用户作为下拉默认选项
  const loadUserOptions = useCallback(async () => {
    setUserSearchLoading(true);
    try {
      const res = await api.users({ page: 1, pageSize: 50 });
      setUserSearchResults(
        (res.items || []).map((u: any) => ({
          id: u.id,
          nickname: u.nickname ?? null,
          phone: u.phone ?? null,
          email: u.email ?? null,
        })),
      );
    } catch (e: any) {
      // 静默
    } finally {
      setUserSearchLoading(false);
    }
  }, []);

  const refreshAudienceStats = useCallback(async () => {
    if (audience === 'user' && !targetUserId) {
      setAudienceStats(null);
      return;
    }
    setAudienceLoading(true);
    try {
      const res = await api.pushPreviewAudience({
        audience,
        targetUserId: audience === 'user' ? targetUserId : undefined,
      });
      setAudienceStats({
        usersCount: res.usersCount,
        devicesCount: res.devicesCount,
        user: res.user ?? null,
      });
    } catch (e: any) {
      message.error(e?.message ?? '预览失败');
      setAudienceStats(null);
    } finally {
      setAudienceLoading(false);
    }
  }, [audience, targetUserId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.pushHistory({ page, pageSize });
      setHistory(res.items);
      setTotal(res.total);
    } catch (e: any) {
      message.error(e?.message ?? '历史加载失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadUserOptions();
  }, [loadUserOptions]);

  useEffect(() => {
    refreshAudienceStats();
  }, [refreshAudienceStats]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onSend = async () => {
    try {
      const values = await form.validateFields();
      if (audience === 'user' && !targetUserId) {
        message.error('请选择目标用户');
        return;
      }
      setSending(true);
      const res = await api.pushSend({
        audience,
        targetUserId: audience === 'user' ? targetUserId : undefined,
        title: values.title,
        body: values.body,
      });
      if (res.ok && res.deliveredCount > 0) {
        message.success(`已投递 ${res.deliveredCount} 个用户 / ${res.devicesCount} 台设备`);
      } else {
        message.warning(
          `投递结果：成功 ${res.deliveredCount}，失败 ${res.failedCount}${res.errorMessage ? `，原因：${res.errorMessage}` : ''}`,
        );
      }
      form.resetFields(['title', 'body']);
      loadHistory();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message ?? '发送失败');
    } finally {
      setSending(false);
    }
  };

  const userOptions = useMemo(
    () =>
      userSearchResults.map((u) => ({
        label: displayUser(u),
        value: u.id,
      })),
    [userSearchResults],
  );

  const audienceBanner = (() => {
    if (audienceLoading) return <Spin size="small" />;
    if (audience === 'all' && audienceStats) {
      return (
        <Alert
          type={audienceStats.devicesCount > 0 ? 'info' : 'warning'}
          showIcon
          message={
            audienceStats.devicesCount > 0
              ? `将推送给 ${audienceStats.usersCount} 个活跃用户的 ${audienceStats.devicesCount} 台 iOS 设备`
              : '当前无任何活跃 iOS 设备，发送将无效果'
          }
        />
      );
    }
    if (audience === 'user') {
      if (!targetUserId) {
        return <Alert type="warning" showIcon message="请选择目标用户" />;
      }
      if (!audienceStats) return null;
      if (audienceStats.devicesCount === 0) {
        return (
          <Alert
            type="warning"
            showIcon
            message={`该用户尚无活跃 iOS 设备（未注册推送 token 或未授予通知权限）`}
          />
        );
      }
      return (
        <Alert
          type="info"
          showIcon
          message={`将推送给该用户 ${audienceStats.devicesCount} 台 iOS 设备`}
        />
      );
    }
    return null;
  })();

  const historyColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 165,
      render: (v: string) => v?.slice(0, 19).replace('T', ' '),
    },
    {
      title: '受众',
      dataIndex: 'audience',
      key: 'audience',
      width: 130,
      render: (a: string, r: any) =>
        a === 'all' ? (
          <Tag color="blue">全部用户</Tag>
        ) : (
          <Tooltip title={r.targetUser?.id}>
            <Tag color="purple">单用户：{displayUser(r.targetUser)}</Tag>
          </Tooltip>
        ),
    },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true, width: 180 },
    { title: '内容', dataIndex: 'body', key: 'body', ellipsis: true },
    {
      title: '投递',
      key: 'stats',
      width: 200,
      render: (_: unknown, r: any) => (
        <Space size={4}>
          <Tag>设备 {r.devicesCount}</Tag>
          <Tag color="green">成功 {r.deliveredCount}</Tag>
          {r.failedCount > 0 && <Tag color="red">失败 {r.failedCount}</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) =>
        s === 'done' ? <Tag color="green">完成</Tag> : <Tag color="red">{s}</Tag>,
    },
    {
      title: '错误',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      ellipsis: true,
      width: 200,
      render: (v: string | null) => v || '-',
    },
    {
      title: '发起者',
      key: 'sentByAdmin',
      width: 160,
      render: (_: unknown, r: any) => displayUser(r.sentByAdmin),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1F2D3D' }}>推送通知</h2>

      <Card style={{ marginBottom: 16 }} title="发起推送">
        <Form form={form} layout="vertical" initialValues={{ audience: 'all' }}>
          <Form.Item label="受众">
            <Radio.Group
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value);
                if (e.target.value === 'all') setTargetUserId(undefined);
              }}
            >
              <Radio value="all">全部活跃 iOS 用户</Radio>
              <Radio value="user">指定单个用户</Radio>
            </Radio.Group>
          </Form.Item>

          {audience === 'user' && (
            <Form.Item label="目标用户">
              <Select
                showSearch
                allowClear
                value={targetUserId}
                placeholder="输入昵称 / 手机号 / 邮箱搜索"
                loading={userSearchLoading}
                onChange={(v) => setTargetUserId(v)}
                options={userOptions}
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                style={{ maxWidth: 480 }}
              />
            </Form.Item>
          )}

          <div style={{ marginBottom: 16 }}>{audienceBanner}</div>

          <Form.Item
            name="title"
            label="通知标题"
            rules={[{ required: true, message: '请输入标题' }, { max: 180 }]}
          >
            <Input placeholder="例：新版本上线 / 重要安全提醒" />
          </Form.Item>

          <Form.Item
            name="body"
            label="通知内容"
            rules={[{ required: true, message: '请输入内容' }, { max: 800 }]}
          >
            <Input.TextArea rows={3} placeholder="一句话告诉用户发生了什么" />
          </Form.Item>

          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={sending}
            onClick={onSend}
            disabled={audience === 'user' && !targetUserId}
          >
            发送推送
          </Button>
          <span style={{ marginLeft: 12, color: '#888', fontSize: 12 }}>
            iOS 端必须已登录 + 授权通知 + 至少进入过一次 App 才能收到
          </span>
        </Form>
      </Card>

      <Card
        title="推送历史"
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={loadHistory}>
            刷新
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={historyLoading}
          dataSource={history}
          columns={historyColumns}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
          }}
          size="middle"
        />
      </Card>
    </div>
  );
}
