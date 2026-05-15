const API_BASE = import.meta.env.VITE_API_URL || '/api';
const WEB_VERSION = import.meta.env.VITE_BUILD || 'dev';

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
  /** Skip auth (for public endpoints) */
  skipAuth?: boolean;
}

async function fetchApi<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, skipAuth, ...rest } = options;
  const token = await getToken();
  if (!token && !skipAuth) {
    throw new ApiError(401, 'no_clerk_token');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-web-version': WEB_VERSION,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers as Record<string, string> || {}),
  };

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const response = await fetch(url, { ...rest, headers });

  if (!response.ok) {
    const requestId = response.headers.get('x-request-id');
    const bodyText = await response.text();
    let body: any = null;
    try { body = JSON.parse(bodyText); } catch { /* not JSON */ }

    // ── Surface to console so user can paste it ───────────────
    console.error(`[api.fail] ${response.status} ${endpoint}`, {
      requestId,
      reason: body?.reason,
      detail: body?.detail,
      issues: body?.issues,
      rawBody: bodyText.slice(0, 500),
    });

    const detail = body?.detail ?? body?.message ?? body?.error ?? bodyText.slice(0, 200) ?? response.statusText;
    const err = new ApiError(response.status, detail);
    (err as any).reason = body?.reason ?? null;
    (err as any).issues = body?.issues ?? null;
    (err as any).requestId = requestId ?? body?.requestId ?? null;
    throw err;
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export class ApiError extends Error {
  public reason: string | null;
  public issues: Array<{ path: string; message: string; code: string }> | null;
  public requestId: string | null;

  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.reason = null;
    this.issues = null;
    this.requestId = null;
  }

  /** Don't auto-retry for these status codes */
  get isRetryable(): boolean {
    return this.status !== 400 && this.status !== 409 && this.status !== 413;
  }

  /** Full diagnostic string for copy-paste */
  toString(): string {
    return `ApiError[${this.status}] reason=${this.reason} requestId=${this.requestId} — ${this.message}`;
  }
}

export const api = {
  get: <T = unknown>(endpoint: string, params?: FetchOptions['params'], skipAuth?: boolean) =>
    fetchApi<T>(endpoint, { method: 'GET', params, skipAuth }),

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
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'x-web-version': WEB_VERSION,
      },
      body: formData,
    });
    if (!response.ok) {
      const requestId = response.headers.get('x-request-id');
      const bodyText = await response.text();
      let body: any = null;
      try { body = JSON.parse(bodyText); } catch { /* not JSON */ }
      console.error(`[api.fail] ${response.status} ${endpoint}`, { requestId, reason: body?.reason });
      const detail = body?.detail ?? body?.message ?? body?.error ?? 'Upload failed';
      const err = new ApiError(response.status, detail);
      (err as any).reason = body?.reason ?? null;
      (err as any).requestId = requestId ?? body?.requestId ?? null;
      throw err;
    }
    return response.json();
  },
};
