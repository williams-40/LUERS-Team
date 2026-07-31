import { useEffect, useRef, useState } from 'react';
import { tokenStorage } from '../lib/api-client';
import { ReportSocket, type ChatMessagePayload, type SocketStatus } from '../lib/ws-client';
import type { ReportListItem, Status } from '../types/domain';
import { useAuth } from './useAuth';

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000';

export interface UseReportSocketOptions {
  /** Subscribe to a single report's group in addition to (or instead of) the general one. */
  reportId?: string;
  onReportCreated?: (report: ReportListItem) => void;
  onReportUpdated?: (report: ReportListItem) => void;
  onChatMessage?: (message: ChatMessagePayload) => void;
}

/**
 * Opens one ws/reports/ connection for the lifetime of the calling component.
 * Handlers are read through a ref so passing new inline callbacks each render
 * doesn't tear down and reopen the socket — only `reportId` and auth state do.
 */
export function useReportSocket({
  reportId,
  onReportCreated,
  onReportUpdated,
  onChatMessage,
}: UseReportSocketOptions) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<SocketStatus>('closed');
  const socketRef = useRef<ReportSocket | null>(null);
  const handlersRef = useRef({ onReportCreated, onReportUpdated, onChatMessage });
  handlersRef.current = { onReportCreated, onReportUpdated, onChatMessage };

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = new ReportSocket(WS_BASE_URL, tokenStorage.getAccess, reportId, {
      onStatusChange: setStatus,
      onMessage: (msg) => {
        if (msg.type === 'report_created') handlersRef.current.onReportCreated?.(msg.data);
        else if (msg.type === 'report_updated') handlersRef.current.onReportUpdated?.(msg.data);
        else if (msg.type === 'chat_message') handlersRef.current.onChatMessage?.(msg.data);
      },
    });
    socketRef.current = socket;
    socket.connect();

    return () => {
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, reportId]);

  function sendChatMessage(content: string) {
    if (!reportId) return;
    socketRef.current?.send({ type: 'chat_message', report_id: reportId, content });
  }

  function sendStatusUpdate(args: { status: Status; expectedUpdatedAt: string }) {
    if (!reportId) return;
    socketRef.current?.send({
      type: 'status_update',
      report_id: reportId,
      status: args.status,
      expected_updated_at: args.expectedUpdatedAt,
      client_timestamp: new Date().toISOString(),
    });
  }

  function reconnect() {
    socketRef.current?.reconnect();
  }

  return { status, sendChatMessage, sendStatusUpdate, reconnect };
}
