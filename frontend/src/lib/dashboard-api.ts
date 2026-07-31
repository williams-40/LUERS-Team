import { apiClient } from './api-client';
import type { DashboardSummary, DashboardTrends } from '../types/domain';

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary/');
  return data;
}

export async function fetchDashboardTrends(days = 30): Promise<DashboardTrends> {
  const { data } = await apiClient.get<DashboardTrends>('/dashboard/trends/', { params: { days } });
  return data;
}
