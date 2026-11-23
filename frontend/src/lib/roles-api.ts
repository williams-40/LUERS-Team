import { apiClient } from './api-client';
import type { Permission, RoleInfo } from '../types/domain';

export interface Role extends RoleInfo {
  permissions: string[];
}

export interface RoleFilters {
  is_active?: boolean;
}

export interface RoleInput {
  slug: string;
  label: string;
  description: string;
  permissions: string[];
  is_active: boolean;
}

// Role/Permission lists are unpaginated (small, bounded catalogues) — see
// RoleListCreateView/PermissionListView (pagination_class = None).
export async function fetchRoles(filters: RoleFilters = {}): Promise<Role[]> {
  const { data } = await apiClient.get<Role[]>('/roles/', { params: filters });
  return data;
}

export async function fetchRole(id: string): Promise<Role> {
  const { data } = await apiClient.get<Role>(`/roles/${id}/`);
  return data;
}

export async function createRole(input: RoleInput): Promise<Role> {
  const { data } = await apiClient.post<Role>('/roles/', input);
  return data;
}

export async function updateRole(id: string, input: Partial<RoleInput>): Promise<Role> {
  const { data } = await apiClient.patch<Role>(`/roles/${id}/`, input);
  return data;
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/roles/${id}/`);
}

export async function fetchPermissions(): Promise<Permission[]> {
  const { data } = await apiClient.get<Permission[]>('/permissions/');
  return data;
}
