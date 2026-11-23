import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

const ACCESS_TOKEN_KEY = 'luers.accessToken';
const REFRESH_TOKEN_KEY = 'luers.refreshToken';

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Queues concurrent requests while a single refresh is in flight, so a burst
// of 401s doesn't fire multiple parallel refresh calls against the backend.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) {
    throw new Error('No refresh token available');
  }
  const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
  const { access } = response.data as { access: string };
  tokenStorage.set(access, refresh);
  return access;
}

/** /auth/login/ and /auth/refresh/ 401s are login/refresh failures, not "your session expired" — never retried via refresh. */
const AUTH_ENDPOINTS = ['/auth/login/', '/auth/refresh/'];
function isAuthEndpoint(url?: string): boolean {
  return Boolean(url && AUTH_ENDPOINTS.some((path) => url.includes(path)));
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      originalRequest._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const newAccessToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch {
        tokenStorage.clear();
        window.location.assign('/login');
        return Promise.reject(error);
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

/** DRF error envelope shape this backend uses: { detail: string } or { field: [msg, ...] }. */
export interface ApiError {
  status: number | null;
  detail: string;
  fieldErrors: Record<string, string[]> | null;
}

function normalizeError(error: AxiosError): ApiError {
  const status = error.response?.status ?? null;
  const data = error.response?.data as Record<string, unknown> | undefined;

  if (status === 429) {
    return {
      status,
      detail: "You've hit the hourly report limit. Please try again in a bit.",
      fieldErrors: null,
    };
  }

  if (status === 409) {
    return {
      status,
      detail: 'This report changed since you last loaded it. Refresh and try again.',
      fieldErrors: null,
    };
  }

  if (data && typeof data === 'object') {
    if (typeof data.detail === 'string') {
      return { status, detail: data.detail, fieldErrors: null };
    }
    const fieldErrors = Object.fromEntries(
      Object.entries(data).filter(([, v]) => Array.isArray(v)),
    ) as Record<string, string[]>;
    if (Object.keys(fieldErrors).length > 0) {
      return { status, detail: 'Please fix the highlighted fields.', fieldErrors };
    }
  }

  return { status, detail: 'Something went wrong. Please try again.', fieldErrors: null };
}
