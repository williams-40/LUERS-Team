import { apiClient } from './api-client';
import { downloadBlob } from './utils';
import type { Action, AuditLogEntry, Paginated } from '../types/domain';

export interface AuditLogFilters {
  report?: string;
  actor?: string;
  action?: Action;
  date_from?: string;
  date_to?: string;
  page?: number;
}

export async function fetchAuditLog(filters: AuditLogFilters = {}): Promise<Paginated<AuditLogEntry>> {
  const { data } = await apiClient.get<Paginated<AuditLogEntry>>('/audit/', { params: filters });
  return data;
}

export async function downloadAuditLogExport(
  filters: Omit<AuditLogFilters, 'page'>,
  exportFormat: 'csv' | 'pdf',
): Promise<void> {
  const response = await apiClient.get('/audit/export/', {
    params: { ...filters, export_format: exportFormat },
    responseType: 'blob',
  });
  downloadBlob(response.data as Blob, `audit_log.${exportFormat}`);
}
