const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Token getter set by main.tsx after Clerk loads
let _getToken: (() => Promise<string | null>) | null = null;

export function setClerkTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

async function getToken(): Promise<string | null> {
  try {
    if (_getToken) return await _getToken();
    return null;
  } catch {
    return null;
  }
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function fetchApi<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const token = await getToken();
  if (!token && !options.headers?.['skip-auth' as keyof HeadersInit]) {
    throw new ApiError(401, 'no_clerk_token');
  }
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let url = `${API_BASE}${endpoint}`;
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, error.detail || error.message || 'Request failed');
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  get: <T = unknown>(endpoint: string, params?: FetchOptions['params']) =>
    fetchApi<T>(endpoint, { method: 'GET', params }),

  post: <T = unknown>(endpoint: string, data?: unknown) =>
    fetchApi<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),

  put: <T = unknown>(endpoint: string, data?: unknown) =>
    fetchApi<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),

  patch: <T = unknown>(endpoint: string, data?: unknown) =>
    fetchApi<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: <T = unknown>(endpoint: string) =>
    fetchApi<T>(endpoint, { method: 'DELETE' }),

  upload: async <T = unknown>(endpoint: string, formData: FormData): Promise<T> => {
    const token = await getToken();
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiError(response.status, error.detail || 'Upload failed');
    }
    return response.json();
  },
};
