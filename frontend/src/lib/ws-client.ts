import type { ReportListItem, Status } from '../types/domain';

export interface ChatMessagePayload {
  id: string;
  sender: string;
  content: string;
  created_at: string;
}

export type ServerMessage =
  | { type: 'pong'; timestamp: string }
  | { type: 'error'; message: string; errors?: Record<string, string[]> }
  | { type: 'report_created'; data: ReportListItem }
  | { type: 'report_updated'; data: ReportListItem }
  | { type: 'chat_message'; data: ChatMessagePayload };

export type ClientMessage =
  | { type: 'ping' }
  | {
      type: 'status_update';
      report_id: string;
      status: Status;
      expected_updated_at?: string;
      client_timestamp?: string;
    }
  | { type: 'chat_message'; report_id: string; content: string };

export type SocketStatus = 'connecting' | 'open' | 'closed';

const PING_INTERVAL_MS = 25_000;
const MAX_RECONNECT_DELAY_MS = 15_000;
const MAX_RECONNECT_ATTEMPTS = 6;

/**
 * Thin reconnecting wrapper around the raw ws/reports/ socket. Reads the
 * access token fresh from `getToken()` on every (re)connect attempt, so a
 * reconnect after the 1hr access token expires picks up whatever token is
 * current in storage rather than the one captured at construction time.
 */
export class ReportSocket {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private closedByCaller = false;

  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null,
    private readonly reportId: string | undefined,
    private readonly handlers: {
      onMessage: (msg: ServerMessage) => void;
      onStatusChange: (status: SocketStatus) => void;
    },
  ) {}

  connect(): void {
    const token = this.getToken();
    if (!token) return;

    this.closedByCaller = false;
    this.handlers.onStatusChange('connecting');

    const params = new URLSearchParams({ token });
    if (this.reportId) params.set('report_id', this.reportId);
    const ws = new WebSocket(`${this.baseUrl}/ws/reports/?${params.toString()}`);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.handlers.onStatusChange('open');
      this.pingTimer = setInterval(() => this.send({ type: 'ping' }), PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      try {
        this.handlers.onMessage(JSON.parse(event.data as string) as ServerMessage);
      } catch {
        // Ignore malformed frames rather than crashing the socket handler.
      }
    };

    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.handlers.onStatusChange('closed');
      if (!this.closedByCaller && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
        this.reconnectAttempts += 1;
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      }
    };
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.closedByCaller = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
