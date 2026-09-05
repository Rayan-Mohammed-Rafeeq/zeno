// API Client configuration

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('accessToken');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Request failed' }));
    const message =
      errorBody?.message ||
      errorBody?.error ||
      'Request failed';
    throw new ApiError(message, response.status, errorBody);
  }

  const body = await response.json();
  return (body?.data !== undefined ? body.data : body) as T;
}

/**
 * Like apiRequest but also returns the `meta` field (pagination info).
 * Use this for paginated list endpoints.
 */
export async function apiRequestPaged<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T[]; meta: { page: number; size: number; totalElements: number; totalPages: number } }> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(errorBody?.message || 'Request failed', response.status, errorBody);
  }
  const body = await response.json();
  return {
    data: (body?.data ?? []) as T[],
    meta: body?.meta ?? { page: 0, size: 20, totalElements: 0, totalPages: 0 },
  };
}

// Mock API mode — controlled by VITE_MOCK_API env var (default: false)
export const MOCK_API_ENABLED = import.meta.env.VITE_MOCK_API === 'true';

export function delay(ms: number = 500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
