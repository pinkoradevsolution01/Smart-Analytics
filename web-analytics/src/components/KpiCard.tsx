import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

type KpiCardProps = {
  label: string;
  value: string;
  change?: number | null;
  helper?: string;
  tone?: 'normal' | 'warning';
};

export function KpiCard({ label, value, change, helper, tone = 'normal' }: KpiCardProps) {
  const hasComparison = typeof change === 'number';
  const up = (change ?? 0) > 0;
  const down = (change ?? 0) < 0;
  const labelText = hasComparison
    ? `${Math.abs(change ?? 0).toFixed(1)}% vs previous period`
    : helper || 'No prior-period comparison';

  return <article className={`kpi ${tone}`}>
    <p>{label}</p>
    <strong>{value}</strong>
    <span className={up ? 'up' : down ? 'down' : 'neutral'}>
      {up ? <ArrowUpRight size={14} /> : down ? <ArrowDownRight size={14} /> : <Minus size={14} />}
      {labelText}
    </span>
  </article>;
}