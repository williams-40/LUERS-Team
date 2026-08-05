import { apiClient } from './api-client';
import type { Paginated, User } from '../types/domain';

export interface AdminUserFilters {
  /** Comma-separated role slugs, e.g. "security,ict_admin". */
  role?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
}

export interface CreateUserInput {
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  /** Role slug — resolved server-side via SlugRelatedField. */
  role: string;
  university_id?: string;
  password: string;
}

export interface UpdateUserInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  /** Role slug — resolved server-side via SlugRelatedField. */
  role?: string;
  university_id?: string;
  is_active?: boolean;
}

export async function fetchUsers(filters: AdminUserFilters = {}): Promise<Paginated<User>> {
  const { data } = await apiClient.get<Paginated<User>>('/auth/users/', { params: filters });
  return data;
}

export async function fetchUser(id: string): Promise<User> {
  const { data } = await apiClient.get<User>(`/auth/users/${id}/`);
  return data;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const { data } = await apiClient.post<User>('/auth/users/', input);
  return data;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const { data } = await apiClient.patch<User>(`/auth/users/${id}/`, input);
  return data;
}
