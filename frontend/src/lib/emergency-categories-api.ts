import { apiClient } from './api-client';
import type { EmergencyCategory, EmergencyCategoryInput, Paginated } from '../types/domain';

export interface EmergencyCategoryFilters {
  is_active?: boolean;
  page?: number;
}

export async function fetchEmergencyCategories(
  filters: EmergencyCategoryFilters = {},
): Promise<Paginated<EmergencyCategory>> {
  const { data } = await apiClient.get<Paginated<EmergencyCategory>>('/emergency-categories/', { params: filters });
  return data;
}

export async function fetchEmergencyCategory(id: string): Promise<EmergencyCategory> {
  const { data } = await apiClient.get<EmergencyCategory>(`/emergency-categories/${id}/`);
  return data;
}

export async function createEmergencyCategory(input: EmergencyCategoryInput): Promise<EmergencyCategory> {
  const { data } = await apiClient.post<EmergencyCategory>('/emergency-categories/', input);
  return data;
}

export async function updateEmergencyCategory(
  id: string,
  input: Partial<EmergencyCategoryInput>,
): Promise<EmergencyCategory> {
  const { data } = await apiClient.patch<EmergencyCategory>(`/emergency-categories/${id}/`, input);
  return data;
}

export async function deleteEmergencyCategory(id: string): Promise<void> {
  await apiClient.delete(`/emergency-categories/${id}/`);
}
