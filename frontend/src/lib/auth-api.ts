import { apiClient, tokenStorage } from './api-client';
import type { User } from '../types/domain';

export interface LoginInput {
  username: string;
  password: string;
}

interface LoginResponse {
  access: string;
  refresh: string;
}

export async function login(input: LoginInput): Promise<void> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login/', input);
  tokenStorage.set(data.access, data.refresh);
}

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me/');
  return data;
}

export function logout(): void {
  // No dedicated logout/blacklist endpoint on this backend today — clearing
  // the stored tokens client-side is sufficient (the refresh token simply
  // stops being used; it still expires naturally at REFRESH_TOKEN_LIFETIME).
  tokenStorage.clear();
}
