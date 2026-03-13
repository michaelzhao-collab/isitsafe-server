/**
 * 统一 Axios 封装：自动注入 token、统一 baseURL、统一错误处理
 */
import axios from 'axios';

// 默认走线上正式接口（也可用 .env 覆盖）
const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://api.starlensai.com/api';

export const getToken = (): string | null => localStorage.getItem('adminToken');

const request = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

request.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

request.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.message ?? err.message ?? '请求失败';
    if (err.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    return Promise.reject(new Error(msg));
  }
);

export default request;
