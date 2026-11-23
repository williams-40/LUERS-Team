import { apiClient } from './api-client';
import type { Message, Paginated } from '../types/domain';

export async function fetchMessages(reportId: string): Promise<Paginated<Message>> {
  const { data } = await apiClient.get<Paginated<Message>>(`/reports/${reportId}/messages/`);
  return data;
}

// Voice notes go over REST (multipart), not the WebSocket text-chat path —
// the server broadcasts the resulting message to the report's WS group
// itself, so live listeners see it without waiting on this response.
export async function sendVoiceMessage(reportId: string, file: File): Promise<Message> {
  const form = new FormData();
  form.append('attachment', file);
  const { data } = await apiClient.post<Message>(`/reports/${reportId}/messages/create/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
