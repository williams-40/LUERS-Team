import type { SocketStatus } from '../../lib/ws-client';
import { cn } from '../../lib/utils';

const COPY: Record<SocketStatus, string> = {
  open: 'Live',
  connecting: 'Connecting…',
  closed: 'Offline',
};

const DOT: Record<SocketStatus, string> = {
  open: 'bg-status-good',
  connecting: 'bg-status-warning animate-pulse',
  closed: 'bg-ink-muted',
};

export function LiveIndicator({ status, className }: { status: SocketStatus; className?: string }) {
  return (
    <span className={cn('text-ink-muted inline-flex items-center gap-1.5 text-[11px] font-semibold', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT[status])} />
      {COPY[status]}
    </span>
  );
}
