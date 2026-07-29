import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMessages } from '../../lib/notifications-api';
import type { ChatMessagePayload } from '../../lib/ws-client';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ReportChat({
  reportId,
  liveMessages,
  onSend,
  canSend,
}: {
  reportId: string;
  liveMessages: ChatMessagePayload[];
  onSend: (content: string) => void;
  canSend: boolean;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', reportId, 'messages'],
    queryFn: () => fetchMessages(reportId),
  });

  const messages = useMemo(() => {
    const history: ChatMessagePayload[] = (data?.results ?? []).map((m) => ({
      id: m.id,
      sender: m.sender_username,
      content: m.content,
      created_at: m.created_at,
    }));
    const merged = [...history];
    for (const live of liveMessages) {
      if (!merged.some((m) => m.id === live.id)) merged.push(live);
    }
    // Compare as Date instants, not raw strings — the REST and WS payloads
    // render created_at with different UTC offsets for the same moment, so
    // a string sort orders them wrong.
    return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [data, liveMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  function handleSend() {
    const content = draft.trim();
    if (!content) return;
    onSend(content);
    setDraft('');
  }

  return (
    <div className="mb-5 rounded-xl border border-black/10 p-4">
      <h2 className="text-ink-secondary mb-3 text-[12.5px] font-semibold">Messages</h2>

      {isLoading && <p className="text-ink-muted text-sm">Loading…</p>}

      <div className="mb-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
        {messages.length === 0 && !isLoading && <p className="text-ink-muted text-sm">No messages yet.</p>}
        {messages.map((m) => {
          const isMine = m.sender === user?.username;
          return (
            <div
              key={m.id}
              className={cn(
                'max-w-[80%] rounded-lg px-3 py-1.5 text-sm',
                isMine ? 'bg-brand/10 self-end' : 'bg-black/4 self-start',
              )}
            >
              {!isMine && <p className="text-ink-muted mb-0.5 text-[11px] font-semibold">{m.sender}</p>}
              <p className="whitespace-pre-wrap">{m.content}</p>
              <p className="text-ink-muted mt-0.5 text-right text-[10px]">{timeLabel(m.created_at)}</p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={canSend ? 'Write a message…' : 'Connecting…'}
          disabled={!canSend}
          className="flex-1 rounded-lg border-[1.5px] border-black/15 px-2.5 py-1.5 text-sm disabled:opacity-50"
        />
        <Button size="sm" onClick={handleSend} disabled={!canSend || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
