import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Button, Modal, Form, Input, message, Breadcrumb } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  BookOutlined,
  ApiOutlined,
  SettingOutlined,
  BarChartOutlined,
  TeamOutlined,
  LogoutOutlined,
  MessageOutlined,
  CrownOutlined,
  LockOutlined,
  HomeOutlined,
  SafetyOutlined,
  SoundOutlined,
  EyeOutlined,
  AudioOutlined,
} from '@ant-design/icons';
import { useAuth } from '../auth';
import { changePassword } from '../api/admin';

const { Header, Sider, Content } = AntLayout;

// 二级分组菜单（全中文）
const menuItems: MenuProps['items'] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '总览' },
  {
    key: 'group-business',
    icon: <UserOutlined />,
    label: '业务运营',
    children: [
      { key: '/users', label: '用户管理' },
      { key: '/queries', label: 'AI 查询记录' },
      { key: '/reports', label: '用户举报' },
      { key: '/feedback', label: '用户反馈' },
    ],
  },
  {
    key: 'group-content',
    icon: <BookOutlined />,
    label: '内容管理',
    children: [
      { key: '/risk-database', label: '风险库' },
      { key: '/knowledge', label: '知识库文章' },
      { key: '/knowledge-categories', label: '分类管理' },
      { key: '/intel', label: '情报中心（V3）' },
      { key: '/intel/submissions', label: '用户上报审批' },
      { key: '/content-fetch', label: 'AI 内容抓取' },
    ],
  },
  {
    key: 'group-v3',
    icon: <SafetyOutlined />,
    label: 'V3 反诈模块',
    children: [
      { key: '/v3/family', icon: <HomeOutlined />, label: '家庭守护（E）' },
      { key: '/v3/elder', icon: <SoundOutlined />, label: '长辈模式（J）' },
      { key: '/v3/deepfake', icon: <AudioOutlined />, label: '语音深伪（A1）' },
      { key: '/v3/breach', icon: <EyeOutlined />, label: '暗网监控（F）' },
    ],
  },
  {
    key: 'group-membership',
    icon: <CrownOutlined />,
    label: '会员体系',
    children: [
      { key: '/membership', label: '会员套餐' },
      { key: '/subscription-orders', label: '订阅订单' },
    ],
  },
  {
    key: 'group-ops',
    icon: <MessageOutlined />,
    label: '消息/数据',
    children: [
      { key: '/messages', label: '消息推送' },
      { key: '/analytics', icon: <BarChartOutlined />, label: '数据分析' },
    ],
  },
  {
    key: 'group-system',
    icon: <SettingOutlined />,
    label: '系统设置',
    children: [
      { key: '/admin-users', icon: <TeamOutlined />, label: '管理员账号' },
      { key: '/ai-settings', icon: <ApiOutlined />, label: 'AI 配置' },
      { key: '/ai-evaluation', label: 'AI 评测中心' },
      { key: '/system-settings', label: '系统设置' },
    ],
  },
];

// 路径到 (面包屑名称, 父分组名称) 的映射
const BREADCRUMB_MAP: Record<string, { label: string; parent?: string }> = {
  '/dashboard': { label: '总览' },
  '/users': { label: '用户管理', parent: '业务运营' },
  '/queries': { label: 'AI 查询记录', parent: '业务运营' },
  '/reports': { label: '用户举报', parent: '业务运营' },
  '/feedback': { label: '用户反馈', parent: '业务运营' },
  '/risk-database': { label: '风险库', parent: '内容管理' },
  '/knowledge': { label: '知识库文章', parent: '内容管理' },
  '/knowledge-categories': { label: '分类管理', parent: '内容管理' },
  '/intel': { label: '情报中心', parent: '内容管理' },
  '/intel/submissions': { label: '用户上报审批', parent: '内容管理' },
  '/content-fetch': { label: 'AI 内容抓取', parent: '内容管理' },
  '/v3/family': { label: '家庭守护', parent: 'V3 反诈模块' },
  '/v3/elder': { label: '长辈模式', parent: 'V3 反诈模块' },
  '/v3/deepfake': { label: '语音深伪', parent: 'V3 反诈模块' },
  '/v3/breach': { label: '暗网监控', parent: 'V3 反诈模块' },
  '/membership': { label: '会员套餐', parent: '会员体系' },
  '/subscription-orders': { label: '订阅订单', parent: '会员体系' },
  '/messages': { label: '消息推送', parent: '消息/数据' },
  '/analytics': { label: '数据分析', parent: '消息/数据' },
  '/admin-users': { label: '管理员账号', parent: '系统设置' },
  '/ai-settings': { label: 'AI 配置', parent: '系统设置' },
  '/ai-evaluation': { label: 'AI 评测中心', parent: '系统设置' },
  '/system-settings': { label: '系统设置', parent: '系统设置' },
};

// 详情页的面包屑（动态路径需特殊处理）
function detailLabel(pathname: string): { label: string; parent?: string } | null {
  if (pathname.startsWith('/users/')) return { label: '用户详情', parent: '业务运营' };
  if (pathname.startsWith('/queries/')) return { label: '查询详情', parent: '业务运营' };
  if (pathname.startsWith('/reports/')) return { label: '举报详情', parent: '业务运营' };
  if (pathname.startsWith('/risk-database/')) return { label: '风险编辑', parent: '内容管理' };
  if (pathname.startsWith('/knowledge/new')) return { label: '新增文章', parent: '内容管理' };
  if (pathname.startsWith('/knowledge/')) return { label: '文章编辑', parent: '内容管理' };
  if (pathname.startsWith('/intel/new')) return { label: '新增情报', parent: '内容管理' };
  if (pathname.startsWith('/intel/') && pathname.endsWith('/edit')) return { label: '编辑情报', parent: '内容管理' };
  return null;
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdForm] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, role } = useAuth();

  const onFinishPwd = async (v: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    if (v.newPassword !== v.confirmPassword) {
      message.error('两次输入的新密码不一致');
      return;
    }
    setPwdLoading(true);
    try {
      await changePassword(v.currentPassword, v.newPassword);
      message.success('密码已修改，请重新登录');
      setPwdModalOpen(false);
      pwdForm.resetFields();
      logout();
    } catch (e: any) {
      message.error(e?.message ?? '修改失败');
    } finally {
      setPwdLoading(false);
    }
  };

  // 仅 SUPERADMIN 可见的菜单 key（admin / readonly 看不到敏感配置）
  const SUPERADMIN_ONLY_KEYS = new Set(['/ai-settings', '/system-settings', '/admin-users']);
  const filteredMenu = useMemo(() => {
    if (role === 'SUPERADMIN') return menuItems;
    const filter = (items: any[]): any[] => items
      .map((it) => {
        if (it.children) {
          const kids = filter(it.children);
          if (kids.length === 0) return null;
          return { ...it, children: kids };
        }
        if (SUPERADMIN_ONLY_KEYS.has(it.key)) return null;
        return it;
      })
      .filter(Boolean);
    return filter(menuItems as any[]);
  }, [role]);

  // 当前选中菜单 key（精确匹配优先，再前缀匹配）
  const selectedKey = useMemo(() => {
    const allKeys: string[] = [];
    const collect = (items: any[]) => {
      for (const it of items) {
        if (it.key) allKeys.push(it.key);
        if (it.children) collect(it.children);
      }
    };
    collect(menuItems as any[]);
    const path = location.pathname;
    const exact = allKeys.find((k) => k === path);
    if (exact) return exact;
    return allKeys.filter((k) => k.startsWith('/') && path.startsWith(k + '/'))
      .sort((a, b) => b.length - a.length)[0] || '/dashboard';
  }, [location.pathname]);

  // 默认展开包含当前菜单的分组
  const openKeys = useMemo(() => {
    const groups = (menuItems as any[]).filter((m) => m.children);
    for (const g of groups) {
      if (g.children.some((c: any) => c.key === selectedKey)) return [g.key];
    }
    return [];
  }, [selectedKey]);

  // breadcrumb
  const crumb = BREADCRUMB_MAP[location.pathname] || detailLabel(location.pathname);

  return (
    <AntLayout style={{ minHeight: '100vh', background: '#F6F8FC' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark" width={220}>
        <div style={{ height: 48, margin: 16, color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/favicon.png" alt="星识安全助手" style={{ height: 28, width: 28, objectFit: 'contain' }} />
          {!collapsed && <span>星识安全助手</span>}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          mode="inline"
          items={filteredMenu}
          onClick={({ key }) => { if (key.startsWith('/')) navigate(key); }}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            background: '#FFFFFF',
            borderBottom: '1px solid #E6EAF0',
          }}
        >
          <Breadcrumb
            items={[
              { title: '首页', href: '#/dashboard' },
              ...(crumb?.parent ? [{ title: crumb.parent }] : []),
              ...(crumb ? [{ title: crumb.label }] : []),
            ]}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="text" icon={<LockOutlined />} onClick={() => setPwdModalOpen(true)}>
              修改密码
            </Button>
            <Button type="text" icon={<LogoutOutlined />} onClick={logout}>
              退出
            </Button>
          </div>
        </Header>
        <Modal
          title="修改密码"
          open={pwdModalOpen}
          onCancel={() => { setPwdModalOpen(false); pwdForm.resetFields(); }}
          footer={null}
          destroyOnClose
        >
          <Form form={pwdForm} layout="vertical" onFinish={onFinishPwd}>
            <Form.Item name="currentPassword" label="当前密码" rules={[{ required: true }]}>
              <Input.Password placeholder="当前登录密码" />
            </Form.Item>
            <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6 }]}>
              <Input.Password placeholder="至少 6 位" />
            </Form.Item>
            <Form.Item name="confirmPassword" label="确认新密码" rules={[{ required: true }]}>
              <Input.Password placeholder="再次输入新密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={pwdLoading}>确认修改</Button>
            </Form.Item>
          </Form>
        </Modal>
        <Content style={{ margin: 24, padding: 24, background: '#FFFFFF', borderRadius: 8, border: '1px solid #E6EAF0' }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
