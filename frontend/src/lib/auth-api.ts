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

export async function logout(): Promise<void> {
  // Must fire before clearing storage — the access token needs to still be
  // there for the request interceptor to attach it as Authorization.
  const refresh = tokenStorage.getRefresh();
  try {
    if (refresh) {
      await apiClient.post('/auth/logout/', { refresh });
    }
  } catch {
    // best-effort — the refresh token will simply expire naturally if this fails
  } finally {
    tokenStorage.clear();
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/auth/password-reset/', { email });
}

export async function confirmPasswordReset(input: {
  uid: string;
  token: string;
  newPassword: string;
}): Promise<void> {
  await apiClient.post('/auth/password-reset/confirm/', {
    uid: input.uid,
    token: input.token,
    new_password: input.newPassword,
  });
}
