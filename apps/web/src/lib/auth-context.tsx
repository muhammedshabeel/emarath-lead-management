'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Agent' | 'CS' | 'Delivery';
  country: string | null;
  active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async (accessToken: string) => {
    try {
      const data = await api.get('/auth/me', accessToken) as User;
      setUser(data);
      setToken(accessToken);
    } catch (error) {
      localStorage.removeItem('emarath_token');
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('emarath_token');
    if (storedToken) {
      fetchUser(storedToken).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const data = await api.post('/auth/login', { email, password }) as { accessToken: string; user: User };
    localStorage.setItem('emarath_token', data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
  };

  const logout = useCallback(() => {
    localStorage.removeItem('emarath_token');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem('emarath_token');
    if (storedToken) {
      await fetchUser(storedToken);
    }
  }, [fetchUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}