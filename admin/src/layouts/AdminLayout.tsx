import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Button } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SearchOutlined,
  FlagOutlined,
  DatabaseOutlined,
  BookOutlined,
  ApiOutlined,
  SettingOutlined,
  BarChartOutlined,
  TeamOutlined,
  LogoutOutlined,
  MessageOutlined,
  CrownOutlined,
  CommentOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useAuth } from '../auth';

const { Header, Sider, Content } = AntLayout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/users', icon: <UserOutlined />, label: 'Users' },
  { key: '/queries', icon: <SearchOutlined />, label: 'AI Queries' },
  { key: '/reports', icon: <FlagOutlined />, label: 'Reports' },
  { key: '/risk-database', icon: <DatabaseOutlined />, label: 'Risk Database' },
  { key: '/knowledge', icon: <BookOutlined />, label: 'Knowledge Base' },
  { key: '/knowledge-categories', icon: <BookOutlined />, label: '分类管理' },
  { key: '/ai-settings', icon: <ApiOutlined />, label: 'AI Settings' },
  { key: '/system-settings', icon: <SettingOutlined />, label: 'System Settings' },
  { key: '/messages', icon: <MessageOutlined />, label: '消息管理' },
  { key: '/feedback', icon: <CommentOutlined />, label: '用户反馈' },
  { key: '/membership', icon: <CrownOutlined />, label: '会员套餐管理' },
  { key: '/subscription-orders', icon: <ShoppingCartOutlined />, label: '会员订单' },
  { key: '/analytics', icon: <BarChartOutlined />, label: 'Analytics' },
  { key: '/admin-users', icon: <TeamOutlined />, label: 'Admin Users' },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const selectedKey = menuItems.some((m) => m.key === location.pathname)
    ? location.pathname
    : menuItems.find((m) => location.pathname.startsWith(m.key + '/'))?.key ?? '/dashboard';

  return (
    <AntLayout style={{ minHeight: '100vh', background: '#F6F8FC' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark" width={220}>
        <div style={{ height: 48, margin: 16, color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
<img src="/favicon.png" alt="星识安全助手" style={{ height: 28, width: 28, objectFit: 'contain' }} />
              <span>星识安全助手</span>
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selectedKey]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            background: '#FFFFFF',
            borderBottom: '1px solid #E6EAF0',
          }}
        >
          <Button type="text" icon={<LogoutOutlined />} onClick={logout}>
            退出
          </Button>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#FFFFFF', borderRadius: 8, border: '1px solid #E6EAF0' }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
