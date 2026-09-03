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
    // Backend wraps errors as ErrorResponse — surface the message field
    const message =
      errorBody?.message ||
      errorBody?.error ||
      'Request failed';
    throw new ApiError(message, response.status, errorBody);
  }

  // Backend wraps all success responses in { data: T, meta: ... }
  const body = await response.json();
  return (body?.data !== undefined ? body.data : body) as T;
}

// Mock API mode — controlled by VITE_MOCK_API env var (default: false)
export const MOCK_API_ENABLED = import.meta.env.VITE_MOCK_API === 'true';

export function delay(ms: number = 500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
