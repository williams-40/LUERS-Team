import { ChartCard } from './ChartCard';

export function TopKeywordsCard({
  data,
  isLoading,
  isError,
}: {
  data?: { keyword: string; count: number }[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  return (
    <ChartCard
      title="Common keywords"
      subtitle="Most frequent words across report descriptions"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && (data ?? []).length === 0}
    >
      <div className="flex flex-wrap gap-1.5">
        {(data ?? []).map((k) => (
          <span key={k.keyword} className="bg-ink/5 rounded-full px-2.5 py-1 text-xs">
            {k.keyword} <span className="text-ink-muted">({k.count})</span>
          </span>
        ))}
      </div>
    </ChartCard>
  );
}
