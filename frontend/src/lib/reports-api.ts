import { apiClient } from './api-client';
import { downloadBlob } from './utils';
import type {
  Category,
  CreateReportInput,
  Evidence,
  Officer,
  Paginated,
  ReportDetail,
  ReportFeedback,
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
  department?: string;
  urgency?: Urgency;
  search?: string;
  since?: string;
  page?: number;
  assigned_to?: string;
  /** Excludes resolved/closed/cancelled/false_alarm — used by ActiveEmergenciesMap. */
  active?: boolean;
  /** Reports a department head manually escalated to System Admin (not the automatic SLA path) — used by EscalatedReportsPanel/Page. */
  escalated_to_admin?: boolean;
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

export async function acknowledgeEmergency(reportId: string): Promise<{ acknowledged_at: string; assigned_to: string }> {
  const { data } = await apiClient.post(`/reports/${reportId}/acknowledge/`);
  return data;
}

export async function respondToEmergency(reportId: string): Promise<{ responding_at: string }> {
  const { data } = await apiClient.post(`/reports/${reportId}/respond/`);
  return data;
}

export async function arriveAtEmergency(reportId: string): Promise<{ arrived_at: string }> {
  const { data } = await apiClient.post(`/reports/${reportId}/arrive/`);
  return data;
}

export async function cancelEmergency(
  reportId: string,
  reason: 'cancelled' | 'false_alarm',
): Promise<{ cancelled_at: string; status: Status }> {
  const { data } = await apiClient.post(`/reports/${reportId}/cancel/`, { reason });
  return data;
}

export async function escalateEmergency(reportId: string, reason: string): Promise<{ escalation_level: number }> {
  const { data } = await apiClient.post(`/reports/${reportId}/escalate/`, { reason });
  return data;
}

export async function updateReportLocation(
  reportId: string,
  location: { latitude: number; longitude: number; location_accuracy?: number },
): Promise<void> {
  await apiClient.patch(`/reports/${reportId}/location/`, location);
}

export async function fetchOfficers(): Promise<Officer[]> {
  const { data } = await apiClient.get<Officer[]>('/auth/officers/');
  return data;
}

/** The report's own department head + members — replaces fetchOfficers (all security officers, unscoped) now that responders are department-scoped. */
export async function fetchAssignableOfficers(reportId: string): Promise<Officer[]> {
  const { data } = await apiClient.get<Officer[]>(`/reports/${reportId}/assignable-officers/`);
  return data;
}

export async function downloadReportsExport(
  filters: Pick<ReportQueueFilters, 'status' | 'category' | 'urgency' | 'search'>,
  exportFormat: 'csv' | 'pdf',
): Promise<void> {
  const response = await apiClient.get('/reports/export/', {
    params: { ...filters, export_format: exportFormat },
    responseType: 'blob',
  });
  downloadBlob(response.data as Blob, `reports.${exportFormat}`);
}

export interface BulkActionResult {
  report_id: string;
  status: 'success' | 'error';
  error?: string;
}

export interface BulkActionResponse {
  results: BulkActionResult[];
}

export async function bulkUpdateStatus(reportIds: string[], newStatus: Status): Promise<BulkActionResponse> {
  const { data } = await apiClient.post<BulkActionResponse>('/reports/bulk/status/', {
    report_ids: reportIds,
    status: newStatus,
  });
  return data;
}

export async function bulkAssignReports(reportIds: string[], assignedTo: string): Promise<BulkActionResponse> {
  const { data } = await apiClient.post<BulkActionResponse>('/reports/bulk/assign/', {
    report_ids: reportIds,
    assigned_to: assignedTo,
  });
  return data;
}

export async function deleteReport(reportId: string): Promise<{ id: string; deleted_at: string }> {
  const { data } = await apiClient.post<{ id: string; deleted_at: string }>(`/reports/${reportId}/delete/`);
  return data;
}

export async function restoreReport(reportId: string): Promise<{ id: string; deleted_at: null }> {
  const { data } = await apiClient.post<{ id: string; deleted_at: null }>(`/reports/${reportId}/restore/`);
  return data;
}

// Irreversible — only ever call this after explicit user confirmation. Only
// works on a report that's already been soft-deleted (the backend 404s
// otherwise), so it can't be used to skip that step.
export async function permanentlyDeleteReport(reportId: string): Promise<void> {
  await apiClient.post(`/reports/${reportId}/delete/permanent/`);
}

export async function fetchDeletedReports(
  filters: Pick<ReportQueueFilters, 'page' | 'search'> = {},
): Promise<Paginated<ReportListItem>> {
  const { data } = await apiClient.get<Paginated<ReportListItem>>('/reports/deleted/', { params: filters });
  return data;
}

export async function submitFeedback(args: {
  reportId: string;
  rating: number;
  comments?: string;
}): Promise<ReportFeedback> {
  const { data } = await apiClient.post<ReportFeedback>(`/reports/${args.reportId}/feedback/`, {
    rating: args.rating,
    comments: args.comments,
  });
  return data;
}

export async function fetchReportFeedback(reportId: string): Promise<ReportFeedback> {
  const { data } = await apiClient.get<ReportFeedback>(`/reports/${reportId}/feedback/`);
  return data;
}

export async function fetchPendingFeedbackReports(): Promise<{ results: ReportListItem[] }> {
  const { data } = await apiClient.get<{ results: ReportListItem[] }>('/reports/pending-feedback/');
  return data;
}

export async function fetchAllFeedback(page = 1): Promise<Paginated<ReportFeedback>> {
  const { data } = await apiClient.get<Paginated<ReportFeedback>>('/reports/feedback/', { params: { page } });
  return data;
}
