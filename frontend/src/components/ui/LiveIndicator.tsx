import type { SocketStatus } from '../../lib/ws-client';
import { cn } from '../../lib/utils';

const COPY: Record<SocketStatus, string> = {
  open: 'Live',
  connecting: 'Connecting…',
  closed: 'Offline',
  disconnected: 'Disconnected',
};

const DOT: Record<SocketStatus, string> = {
  open: 'bg-status-good',
  connecting: 'bg-status-warning animate-pulse',
  closed: 'bg-ink-muted',
  disconnected: 'bg-status-critical',
};

export function LiveIndicator({
  status,
  onReconnect,
  className,
}: {
  status: SocketStatus;
  /** Shown as an inline "Reconnect" affordance only once automatic retries are exhausted (status === 'disconnected'). */
  onReconnect?: () => void;
  className?: string;
}) {
  return (
    <span className={cn('text-ink-muted inline-flex items-center gap-1.5 text-[11px] font-semibold', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT[status])} />
      {COPY[status]}
      {status === 'disconnected' && onReconnect && (
        <button type="button" onClick={onReconnect} className="text-brand underline">
          Reconnect
        </button>
      )}
    </span>
  );
}
