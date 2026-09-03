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

// Shape returned by POST /auth/login (after ApiResponse unwrap)
interface LoginResponseBackend {
  accessToken: string;
  userId: string;
  email: string;
  name: string;
  role: User['role'];
}

// Shape returned by GET /auth/me (after ApiResponse unwrap)
interface UserResponseBackend {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

function backendUserToUser(u: UserResponseBackend): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role ?? 'ANALYST',
    merchantId: '',
    createdAt: u.createdAt,
  };
}

export const authApi = {
  async login(data: LoginRequest): Promise<{ user: User; tokens: AuthTokens }> {
    if (MOCK_API_ENABLED) {
      await delay();
      const tokens: AuthTokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };
      localStorage.setItem('accessToken', tokens.accessToken);
      return { user: mockCurrentUser, tokens };
    }

    const res = await apiRequest<LoginResponseBackend>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    localStorage.setItem('accessToken', res.accessToken);

    // Build a User from the login response fields (avoids a second /me round-trip)
    const user: User = {
      id: res.userId,
      email: res.email,
      name: res.name,
      role: res.role ?? 'ANALYST',
      merchantId: '',
      createdAt: new Date().toISOString(),
    };

    return { user, tokens: { accessToken: res.accessToken, refreshToken: '' } };
  },

  async register(data: RegisterRequest): Promise<{ message: string }> {
    if (MOCK_API_ENABLED) {
      await delay();
      return { message: 'Registration successful. Please check your email to verify your account.' };
    }

    // confirmPassword is client-side only — send only the fields the backend expects
    return apiRequest<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        password: data.password,
        merchantName: data.merchantName,
      }),
    });
  },

  async resendVerification(data: { email: string }): Promise<{ message: string }> {
    if (MOCK_API_ENABLED) {
      await delay();
      return { message: 'Verification email resent.' };
    }

    return apiRequest<{ message: string }>('/auth/resend-verification', {
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

    // Backend expects { token, newPassword } — map from frontend shape
    return apiRequest<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: data.token, newPassword: data.password }),
    });
  },

  async getCurrentUser(): Promise<User> {
    if (MOCK_API_ENABLED) {
      await delay(200);
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('Not authenticated');
      return mockCurrentUser;
    }

    const res = await apiRequest<UserResponseBackend>('/auth/me');
    return backendUserToUser(res);
  },

  async logout(): Promise<void> {
    if (MOCK_API_ENABLED) {
      await delay(200);
      localStorage.removeItem('accessToken');
      return;
    }

    await apiRequest('/auth/logout', { method: 'POST' });
    localStorage.removeItem('accessToken');
  },
};
