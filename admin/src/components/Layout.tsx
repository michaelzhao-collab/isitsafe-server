import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Button, Modal, Form, Input, message } from 'antd';
import { UserOutlined, SearchOutlined, FlagOutlined, BookOutlined, BarChartOutlined, LogoutOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../auth';
import { changePassword } from '../api/admin';

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
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdForm] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

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

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 32, margin: 16, color: '#fff', fontSize: 18 }}>星识</div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, background: '#fff' }}>
          <Button type="text" icon={<LockOutlined />} onClick={() => setPwdModalOpen(true)}>
            修改密码
          </Button>
          <Button type="text" icon={<LogoutOutlined />} onClick={logout}>
            退出
          </Button>
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
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
