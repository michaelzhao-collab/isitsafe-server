import { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Layout as AntLayout, Menu, Button } from 'antd';
import { UserOutlined, SearchOutlined, FlagOutlined, BookOutlined, BarChartOutlined, LogoutOutlined } from '@ant-design/icons';
import { useAuth } from '../auth';

const { Header, Sider, Content } = AntLayout;

const items = [
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/queries', icon: <SearchOutlined />, label: '查询管理' },
  { key: '/reports', icon: <FlagOutlined />, label: '举报管理' },
  { key: '/knowledge', icon: <BookOutlined />, label: '知识库' },
  { key: '/analytics', icon: <BarChartOutlined />, label: 'AI 分析' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 32, margin: 16, color: '#fff', fontSize: 18 }}>IsItSafe</div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: '#fff' }}>
          <Button type="text" icon={<LogoutOutlined />} onClick={logout}>
            退出
          </Button>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
