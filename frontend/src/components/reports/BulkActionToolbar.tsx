import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOfficers } from '../../lib/reports-api';
import { Button } from '../ui/Button';
import { Status } from '../../types/domain';

const STATUS_OPTIONS = Object.values(Status);

export function BulkActionToolbar({
  count,
  onBulkStatus,
  onBulkAssign,
  onClear,
  busy,
}: {
  count: number;
  onBulkStatus: (status: Status) => void;
  onBulkAssign: (officerId: string) => void;
  onClear: () => void;
  busy: boolean;
}) {
  const [status, setStatus] = useState<Status>(Status.ACKNOWLEDGED);
  const [officerId, setOfficerId] = useState('');
  const { data: officers, isLoading: officersLoading } = useQuery({
    queryKey: ['officers'],
    queryFn: fetchOfficers,
  });

  if (count === 0) return null;

  return (
    <div className="bg-brand/8 mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-black/10 px-4 py-3">
      <span className="text-sm font-semibold">
        {count} report{count === 1 ? '' : 's'} selected
      </span>

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as Status)}
        className="rounded-lg border-[1.5px] border-black/15 px-2.5 py-1.5 text-sm"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.replace('_', ' ')}
          </option>
        ))}
      </select>
      <Button size="sm" onClick={() => onBulkStatus(status)} disabled={busy}>
        Apply status
      </Button>

      <select
        value={officerId}
        onChange={(e) => setOfficerId(e.target.value)}
        disabled={officersLoading}
        className="rounded-lg border-[1.5px] border-black/15 px-2.5 py-1.5 text-sm"
      >
        <option value="" disabled>
          {officersLoading ? 'Loading officers…' : 'Select an officer'}
        </option>
        {officers?.map((officer) => (
          <option key={officer.id} value={officer.id}>
            {officer.username}
          </option>
        ))}
      </select>
      <Button size="sm" onClick={() => onBulkAssign(officerId)} disabled={busy || !officerId}>
        Assign
      </Button>

      <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
        Clear selection
      </Button>
    </div>
  );
}
