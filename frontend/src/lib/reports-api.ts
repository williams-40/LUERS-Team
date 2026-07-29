import { apiClient } from './api-client';
import type { CreateReportInput, Evidence, Paginated, ReportDetail, ReportListItem } from '../types/domain';

export async function createReport(input: CreateReportInput): Promise<ReportDetail> {
  const { data } = await apiClient.post<ReportDetail>('/reports/create/', input);
  return data;
}

export async function uploadEvidence(reportId: string, file: File): Promise<Evidence> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<Evidence>(`/reports/${reportId}/evidence/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchMyReports(): Promise<Paginated<ReportListItem>> {
  const { data } = await apiClient.get<Paginated<ReportListItem>>('/reports/mine/');
  return data;
}

export async function fetchReportDetail(id: string): Promise<ReportDetail> {
  const { data } = await apiClient.get<ReportDetail>(`/reports/${id}/`);
  return data;
}
