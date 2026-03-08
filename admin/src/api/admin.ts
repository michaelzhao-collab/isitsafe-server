/**
 * 管理端登录：使用 /api/auth/login（phone 或 email + code）
 */
import request from './request';

export async function login(phoneOrEmail: string, code: string) {
  const body = phoneOrEmail.includes('@')
    ? { email: phoneOrEmail, code }
    : { phone: phoneOrEmail, code };
  const res = await request.post<{ accessToken: string; refreshToken?: string; expiresIn?: number }>('/auth/login', body);
  return res as { accessToken: string; refreshToken?: string; expiresIn?: number };
}
