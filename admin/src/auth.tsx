import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { login as apiLogin } from './api/admin';

const TOKEN_KEY = 'adminToken';

export type AdminRole = 'SUPERADMIN' | 'ADMIN' | 'USER';

type AuthContextType = {
  token: string | null;
  role: AdminRole | null;
  login: (username: string, password: string, turnstileToken?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

/** 从 JWT accessToken 解出 payload.role（不校验签名，仅前端展示用）*/
function decodeRoleFromJwt(jwt: string | null): AdminRole | null {
  if (!jwt) return null;
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    // base64url -> base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '='));
    const payload = JSON.parse(json) as { role?: string };
    const r = payload.role?.toUpperCase();
    if (r === 'SUPERADMIN' || r === 'ADMIN' || r === 'USER') return r;
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const role = useMemo(() => decodeRoleFromJwt(token), [token]);

  const login = useCallback(async (username: string, password: string, turnstileToken?: string) => {
    const { accessToken } = await apiLogin(username, password, turnstileToken);
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
