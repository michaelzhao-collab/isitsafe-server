import { useEffect, useState } from 'react';
import { Card, Descriptions, Button, Spin, message, Avatar, Modal, Form, Input, Select } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import request from '../../api/request';
import { updateUser, type UserItem } from '../../api/users';

const genderOptions = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '未知', value: 'unknown' },
];

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<(UserItem & { lastLogin?: string }) | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    if (!id) return;
    request
      .get(`/admin/users/${id}`)
      .then((res: any) => setUser(res))
      .catch(() => message.error('用户不存在'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const onEditFinish = (values: { nickname?: string; gender?: string; birthday?: string }) => {
    if (!id) return;
    setSaving(true);
    updateUser(id, values)
      .then(() => {
        message.success('保存成功');
        setEditOpen(false);
        load();
      })
      .catch((e) => message.error(e?.message ?? '保存失败'))
      .finally(() => setSaving(false));
  };

  const openEdit = () => {
    if (user) {
      form.setFieldsValue({
        nickname: user.nickname ?? '',
        gender: user.gender ?? 'unknown',
        birthday: user.birthday ?? '',
      });
      setEditOpen(true);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <p>未找到该用户</p>
        <Button type="primary" onClick={() => navigate('/users')}>
          返回列表
        </Button>
      </Card>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>用户详情</h2>
      <Card>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="头像">
            <Avatar src={user.avatar || undefined} size={64} />
          </Descriptions.Item>
          <Descriptions.Item label="ID">{String(user.id)}</Descriptions.Item>
          <Descriptions.Item label="昵称">{String(user.nickname ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="手机">{String(user.phone ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{String(user.email ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="国家">{String(user.country ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="性别">
            {user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : user.gender ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="生日">{String(user.birthday ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="角色">{String(user.role ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="注册时间">{user.createdAt ? String(user.createdAt).slice(0, 19) : '-'}</Descriptions.Item>
          <Descriptions.Item label="最后登录">{user.lastLogin ? String(user.lastLogin).slice(0, 19) : '-'}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 16 }}>
          <Button type="primary" onClick={openEdit} style={{ marginRight: 8 }}>
            编辑资料
          </Button>
          <Button onClick={() => navigate('/users')}>返回列表</Button>
        </div>
      </Card>

      <Modal
        title="编辑用户资料"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onEditFinish}>
          <Form.Item name="nickname" label="昵称">
            <Input placeholder="昵称" />
          </Form.Item>
          <Form.Item name="gender" label="性别">
            <Select options={genderOptions} placeholder="性别" />
          </Form.Item>
          <Form.Item name="birthday" label="生日">
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => setEditOpen(false)}>
              取消
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
