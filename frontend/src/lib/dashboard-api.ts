import { apiClient } from './api-client';
import type { DashboardAnalytics, DashboardSummary, DashboardTrends } from '../types/domain';

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary/');
  return data;
}

export async function fetchDashboardTrends(days = 30): Promise<DashboardTrends> {
  const { data } = await apiClient.get<DashboardTrends>('/dashboard/trends/', { params: { days } });
  return data;
}

export async function fetchDashboardAnalytics(): Promise<DashboardAnalytics> {
  const { data } = await apiClient.get<DashboardAnalytics>('/dashboard/analytics/');
  return data;
}
