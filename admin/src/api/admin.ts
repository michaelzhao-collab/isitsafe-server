/**
 * 管理后台登录：账号 + 密码（与 C 端手机号+验证码分离）
 */
import request from './request';

export async function login(username: string, password: string) {
  const res = await request.post<{ accessToken: string; refreshToken?: string; expiresIn?: number }>('/admin/auth/login', {
    username: username.trim(),
    password,
  });
  return res as unknown as { accessToken: string; refreshToken?: string; expiresIn?: number };
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await request.post<{ success: boolean }>('/admin/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return res as unknown as { success: boolean };
}
