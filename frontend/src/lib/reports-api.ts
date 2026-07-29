import { apiClient } from './api-client';
import type {
  Category,
  CreateReportInput,
  Evidence,
  Officer,
  Paginated,
  ReportDetail,
  ReportListItem,
  Status,
  Urgency,
} from '../types/domain';

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

export interface ReportQueueFilters {
  status?: Status;
  category?: Category;
  urgency?: Urgency;
  since?: string;
  page?: number;
}

export interface ReportQueueResult {
  page: Paginated<ReportListItem>;
  /** From the X-Cursor response header — pass back as `since` for delta-fetch. */
  cursor: string | null;
}

export async function fetchReportQueue(filters: ReportQueueFilters = {}): Promise<ReportQueueResult> {
  const response = await apiClient.get<Paginated<ReportListItem>>('/reports/', { params: filters });
  return { page: response.data, cursor: response.headers['x-cursor'] ?? null };
}

export async function updateReportStatus(args: {
  reportId: string;
  status: Status;
  expectedUpdatedAt: string;
}): Promise<{ status: Status }> {
  const { data } = await apiClient.patch<{ status: Status }>(`/reports/${args.reportId}/status/`, {
    status: args.status,
    expected_updated_at: args.expectedUpdatedAt,
    client_timestamp: new Date().toISOString(),
  });
  return data;
}

export async function assignReport(args: {
  reportId: string;
  assignedTo: string;
  expectedUpdatedAt: string;
}): Promise<{ assigned_to: string }> {
  const { data } = await apiClient.post<{ assigned_to: string }>(`/reports/${args.reportId}/assign/`, {
    assigned_to: args.assignedTo,
    expected_updated_at: args.expectedUpdatedAt,
    client_timestamp: new Date().toISOString(),
  });
  return data;
}

export async function fetchOfficers(): Promise<Officer[]> {
  const { data } = await apiClient.get<Officer[]>('/auth/officers/');
  return data;
}
