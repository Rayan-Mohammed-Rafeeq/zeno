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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Shape returned by the authenticated Spring Boot /api/auth/me endpoint.
interface UserResponseBackend {
  id: number;
  username: string;
  email?: string;
  name: string;
  role: User['role'];
  roleDisplayName: string;
  organizationId?: number;
  active: boolean;
  createdAt: string;
}

function backendUserToUser(u: UserResponseBackend): User {
  return {
    id: String(u.id),
    username: u.username,
    email: u.email || `${u.username}@zeno.example`,
    name: u.name,
    role: u.role ?? 'ANALYST',
    roleDisplayName: u.roleDisplayName,
    organizationId: u.organizationId,
    createdAt: u.createdAt,
  };
}

export const authApi = {
  async login(data: LoginRequest): Promise<{ user: User; tokens: AuthTokens }> {
    const username = data.email.includes('@') ? data.email.split('@')[0] : data.email;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          password: data.password,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Invalid username or password');
      }

      const body = await res.json();
      const token = body.token || body.accessToken;
      if (!token) throw new Error('Login response did not include an access token');
      localStorage.setItem('accessToken', token);

      const user: User = {
        id: String(body.username || username),
        username: body.username || username,
        email: body.email || `${body.username || username}@zeno.example`,
        name: `${body.firstName || ''} ${body.lastName || ''}`.trim() || body.username || username,
        role: body.role || 'PRACTICE_STAFF',
        roleDisplayName: body.roleDisplayName || body.role,
        organizationId: body.organizationId,
        createdAt: new Date().toISOString(),
      };

      return { user, tokens: { accessToken: token, refreshToken: '' } };
    } catch (err) {
      if (!MOCK_API_ENABLED) throw err;
      console.warn('Backend unavailable in explicit mock mode; using demo login:', err);
    }

    // Graceful offline/demo fallback based on username/email
    let role = 'PHARMACIST';
    let roleDisplayName = 'Pharmacist';
    let name = 'Sarah Chen';

    if (username.includes('patel') || username.includes('doctor') || username.includes('williams')) {
      role = 'PROVIDER';
      roleDisplayName = 'Doctor / Provider';
      name = 'Dr. Arun Patel';
    } else if (username.includes('martinez') || username.includes('nurse') || username.includes('staff')) {
      role = 'PRACTICE_STAFF';
      roleDisplayName = 'Practice Staff / Nurse';
      name = 'Lisa Martinez';
    } else if (username.includes('admin')) {
      role = 'ADMIN';
      roleDisplayName = 'System Administrator';
      name = 'System Admin';
    }

    const mockToken = 'zeno-demo-jwt-token';
    localStorage.setItem('accessToken', mockToken);

    const user: User = {
      id: username,
      username,
      email: `${username}@zeno.example`,
      name,
      role,
      roleDisplayName,
      createdAt: new Date().toISOString(),
    };

    return { user, tokens: { accessToken: mockToken, refreshToken: '' } };
  },

  async register(data: RegisterRequest): Promise<{ message: string }> {
    if (MOCK_API_ENABLED) {
      await delay();
      return { message: 'Registration successful. Please check your email to verify your account.' };
    }

    const [firstName, ...lastNameParts] = data.name.trim().split(/\s+/);
    await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: data.email.split('@')[0],
        email: data.email,
        password: data.password,
        role: data.role,
        firstName,
        lastName: lastNameParts.join(' '),
        organizationName: data.merchantName,
      }),
    });
    return { message: 'Workspace created. You can now sign in.' };
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

    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Your session has expired. Please sign in again.');
    return backendUserToUser(await res.json() as UserResponseBackend);
  },

  async logout(): Promise<void> {
    // The API is stateless and has no logout endpoint; end the browser session locally.
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};
