// Authentication API

import type {
  User,
  LoginRequest,
  RegisterRequest,
  VerifyEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  AuthTokens,
} from '@/types';
import { apiRequest, MOCK_API_ENABLED, delay } from './client';
import { mockCurrentUser } from './mockData';

export const authApi = {
  async login(data: LoginRequest): Promise<{ user: User; tokens: AuthTokens }> {
    if (MOCK_API_ENABLED) {
      await delay();
      // Mock successful login
      const tokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      return { user: mockCurrentUser, tokens };
    }
    
    return apiRequest<{ user: User; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async register(data: RegisterRequest): Promise<{ message: string }> {
    if (MOCK_API_ENABLED) {
      await delay();
      return { message: 'Registration successful. Please check your email to verify your account.' };
    }
    
    return apiRequest<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verifyEmail(data: VerifyEmailRequest): Promise<{ message: string }> {
    if (MOCK_API_ENABLED) {
      await delay();
      return { message: 'Email verified successfully. You can now log in.' };
    }
    
    return apiRequest<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
    if (MOCK_API_ENABLED) {
      await delay();
      return { message: 'Password reset instructions sent to your email.' };
    }
    
    return apiRequest<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    if (MOCK_API_ENABLED) {
      await delay();
      return { message: 'Password reset successfully. You can now log in with your new password.' };
    }
    
    return apiRequest<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getCurrentUser(): Promise<User> {
    if (MOCK_API_ENABLED) {
      await delay(200);
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('Not authenticated');
      return mockCurrentUser;
    }
    
    return apiRequest<User>('/auth/me');
  },

  async logout(): Promise<void> {
    if (MOCK_API_ENABLED) {
      await delay(200);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return;
    }
    
    await apiRequest('/auth/logout', { method: 'POST' });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};
