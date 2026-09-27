import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, LoginRequest, RegisterRequest } from '@/types';
import { authApi } from '@/services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest, expectedRole?: User['role']) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authApi.getCurrentUser()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('accessToken');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (data: LoginRequest, expectedRole?: User['role']) => {
    const { user } = await authApi.login(data);
    const actualRole = user.role === 'PHARMACY_STAFF' ? 'PHARMACIST' : user.role;
    if (expectedRole && actualRole !== expectedRole) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      const labels: Record<string, string> = {
        PROVIDER: 'Doctor / Provider',
        PRACTICE_STAFF: 'Practice Staff / Nurse',
        PHARMACIST: 'Pharmacist',
        ADMIN: 'Administrator',
      };
      throw new Error(`This account uses the ${labels[actualRole] ?? actualRole} profile. Select that profile to sign in.`);
    }
    setUser(user);
    navigate('/dashboard');
  };

  const register = async (data: RegisterRequest) => {
    await authApi.register(data);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      navigate('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
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
