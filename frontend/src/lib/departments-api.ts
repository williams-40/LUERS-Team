import { apiClient } from './api-client';
import type { Department, DepartmentInput, Paginated } from '../types/domain';

export interface DepartmentFilters {
  is_active?: boolean;
  page?: number;
}

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
