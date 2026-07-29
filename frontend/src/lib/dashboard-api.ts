import { apiClient } from './api-client';
import type { DashboardSummary } from '../types/domain';

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary/');
  return data;
}
