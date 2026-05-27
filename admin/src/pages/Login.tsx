import { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Card, message, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

/**
 * Cloudflare Turnstile widget 集成
 *  - 通过 .env 配 VITE_TURNSTILE_SITE_KEY 启用；未配则跳过（兼容老登录）
 *  - 使用官方 CDN script，不引入 npm 依赖
 *  - 后端必须同步配 TURNSTILE_SECRET 才会真的校验（双向 fail-open 兼容）
 */
const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || '';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement | string, opts: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
        theme?: 'light' | 'dark' | 'auto';
      }) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [turnstileReady, setTurnstileReady] = useState(false);
  const widgetIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { token, login } = useAuth();

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  // 加载 Turnstile script + 渲染 widget（仅在配置了 SITE_KEY 时）
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      setTurnstileReady(true); // 未启用 → 视为 ready，不阻塞登录
      return;
    }
    const SCRIPT_ID = 'cf-turnstile-script';
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      // 防止热更新时重复渲染
      if (widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
        widgetIdRef.current = null;
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t: string) => setTurnstileToken(t),
        'error-callback': () => setTurnstileToken(''),
        'expired-callback': () => setTurnstileToken(''),
        theme: 'light',
      });
      setTurnstileReady(true);
    };

    if (window.turnstile) {
      renderWidget();
      return;
    }
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', renderWidget);
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
        widgetIdRef.current = null;
      }
    };
  }, []);

  const onFinish = async (v: { username: string; password: string }) => {
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      message.error('请先完成人机验证');
      return;
    }
    setLoading(true);
    try {
      await login(v.username, v.password, turnstileToken || undefined);
      message.success('登录成功');
      navigate('/', { replace: true });
    } catch (e: any) {
      message.error(e?.message || '登录失败');
      // 登录失败时刷新 turnstile token（一次性使用）
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.reset(widgetIdRef.current); } catch { /* ignore */ }
      }
      setTurnstileToken('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F6F8FC' }}>
      <Card title="星识安全助手 管理后台" style={{ width: 400 }}>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input placeholder="admin" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password placeholder="登录密码" autoComplete="current-password" />
          </Form.Item>

          {TURNSTILE_SITE_KEY ? (
            <Form.Item label="安全验证">
              <div ref={containerRef} style={{ minHeight: 70 }} />
              {!turnstileReady && <Alert message="正在加载验证..." type="info" showIcon style={{ marginTop: 8 }} />}
            </Form.Item>
          ) : (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="人机验证未启用"
              description="管理员请配置 VITE_TURNSTILE_SITE_KEY 启用 Cloudflare Turnstile 防爆破"
            />
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              disabled={!!TURNSTILE_SITE_KEY && !turnstileToken}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
