'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

export type UserRole = 'ADMIN' | 'AGENT' | 'CS' | 'DELIVERY';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  country: string | null;
  active: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async (accessToken: string) => {
    try {
      const data = await api.get('/auth/me', accessToken) as User;
      setUser(data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('emarath_token');
      setUser(null);
    }
  };

  const login = async (email: string, password: string) => {
    const data = await api.post('/auth/login', { email, password }) as { accessToken: string; user: User };
    localStorage.setItem('emarath_token', data.accessToken);
    setUser(data.user);
  };

  const logout = useCallback(() => {
    localStorage.removeItem('emarath_token');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('emarath_token');
    if (token) {
      await fetchUser(token);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('emarath_token');
      if (token) {
        await fetchUser(token);
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
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
