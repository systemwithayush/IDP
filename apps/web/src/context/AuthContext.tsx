import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type UserRole = 'admin' | 'lead' | 'developer';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  teamId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = 'http://localhost:4000/api/v1';

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

function roleToName(email: string): string {
  if (email.startsWith('divya')) return 'Divya';
  if (email.startsWith('deepak')) return 'Deepak';
  if (email.startsWith('ayush')) return 'Ayush';
  return email.split('@')[0];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('idp_token');
    const savedUser = localStorage.getItem('idp_user');
    if (savedToken && savedUser) {
      try {
        const payload = decodeJwtPayload(savedToken);
        // Check expiry
        if (payload.exp && typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
          localStorage.removeItem('idp_token');
          localStorage.removeItem('idp_user');
        } else {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch {
        localStorage.removeItem('idp_token');
        localStorage.removeItem('idp_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || 'Invalid credentials');
      }
      const data = await res.json() as { accessToken: string; user: { id: string; email: string; role: UserRole; teamId: string | null } };
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        name: roleToName(data.user.email),
        teamId: data.user.teamId,
      };
      setToken(data.accessToken);
      setUser(authUser);
      localStorage.setItem('idp_token', data.accessToken);
      localStorage.setItem('idp_user', JSON.stringify(authUser));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setError(null);
    localStorage.removeItem('idp_token');
    localStorage.removeItem('idp_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

