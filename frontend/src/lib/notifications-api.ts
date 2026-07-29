import { apiClient } from './api-client';
import type { Message, Paginated } from '../types/domain';

export async function fetchMessages(reportId: string): Promise<Paginated<Message>> {
  const { data } = await apiClient.get<Paginated<Message>>(`/reports/${reportId}/messages/`);
  return data;
}
