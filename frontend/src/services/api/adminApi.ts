// Admin API — ADMIN role only

import { apiRequest, MOCK_API_ENABLED, delay } from './client';

export type AdminUserRole = 'ADMIN' | 'ANALYST' | 'VIEWER';
export type AdminUserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  emailVerified: boolean;
  createdAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  role: AdminUserRole;
}

const mockUsers: AdminUser[] = [
  {
    id: 'mock-1',
    name: 'Admin User',
    email: 'admin@zeno.app',
    role: 'ADMIN',
    status: 'ACTIVE',
    emailVerified: true,
    createdAt: new Date().toISOString(),
  },
];

export const adminApi = {
  async listUsers(): Promise<AdminUser[]> {
    if (MOCK_API_ENABLED) {
      await delay(300);
      return mockUsers;
    }
    return apiRequest<AdminUser[]>('/admin/users');
  },

  async createUser(data: CreateUserRequest): Promise<AdminUser> {
    if (MOCK_API_ENABLED) {
      await delay(500);
      const user: AdminUser = {
        id: `mock-${Date.now()}`,
        name: data.name,
        email: data.email,
        role: data.role,
        status: 'PENDING_VERIFICATION',
        emailVerified: false,
        createdAt: new Date().toISOString(),
      };
      mockUsers.push(user);
      return user;
    }
    return apiRequest<AdminUser>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async suspendUser(userId: string): Promise<AdminUser> {
    if (MOCK_API_ENABLED) {
      await delay(300);
      const u = mockUsers.find(u => u.id === userId);
      if (u) u.status = 'SUSPENDED';
      return u!;
    }
    return apiRequest<AdminUser>(`/admin/users/${userId}/status?action=SUSPEND`, {
      method: 'PATCH',
    });
  },

  async activateUser(userId: string): Promise<AdminUser> {
    if (MOCK_API_ENABLED) {
      await delay(300);
      const u = mockUsers.find(u => u.id === userId);
      if (u) u.status = 'ACTIVE';
      return u!;
    }
    return apiRequest<AdminUser>(`/admin/users/${userId}/status?action=ACTIVATE`, {
      method: 'PATCH',
    });
  },
};
