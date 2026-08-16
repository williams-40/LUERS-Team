import { apiClient } from './api-client';
import type { Department, DepartmentInput, Paginated, User } from '../types/domain';

export interface ResponderInput {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  university_id: string;
}

export interface DepartmentFilters {
  is_active?: boolean;
  page?: number;
}

/**
 * Shared react-query key for "the active departments list, used to work
 * out whether the current user heads any of them" — DashboardSummaryPanel,
 * MyDepartmentResponders, and DashboardPage all derive head-detection off
 * the exact same fetch, so they share one cache entry instead of issuing
 * three duplicate requests.
 */
export const HEAD_DETECTION_DEPARTMENTS_QUERY_KEY = ['departments', { is_active: true, filter: true }] as const;

export async function fetchDepartments(filters: DepartmentFilters = {}): Promise<Paginated<Department>> {
  const { data } = await apiClient.get<Paginated<Department>>('/departments/', { params: filters });
  return data;
}

export async function fetchDepartment(id: string): Promise<Department> {
  const { data } = await apiClient.get<Department>(`/departments/${id}/`);
  return data;
}

export async function createDepartment(input: DepartmentInput): Promise<Department> {
  const { data } = await apiClient.post<Department>('/departments/', input);
  return data;
}

export async function updateDepartment(id: string, input: Partial<DepartmentInput>): Promise<Department> {
  const { data } = await apiClient.patch<Department>(`/departments/${id}/`, input);
  return data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await apiClient.delete(`/departments/${id}/`);
}

/**
 * Phase 6: department-head-only responder creation. No `role`/`department`
 * field is even accepted here — the department comes from the URL, the
 * role is hardcoded server-side, and the account gets an unusable
 * password + a password-reset email rather than any credential ever
 * transiting this call.
 */
export async function createDepartmentResponder(departmentId: string, input: ResponderInput): Promise<User> {
  const { data } = await apiClient.post<User>(`/departments/${departmentId}/responders/`, input);
  return data;
}
