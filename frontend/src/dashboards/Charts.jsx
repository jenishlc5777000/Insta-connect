import { useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { EmptyState, Skeleton, Tabs } from '../components/ui';
import { formatINR, formatNumber } from '../utils/format';

// Validated categorical order (brand blue, teal, purple, amber) - assigned in fixed order, never cycled.
export const SERIES = { clicks: '#2F6BFF', leads: '#0A9F90', paid: '#6E4FE8', revenue: '#2F6BFF' };
const AXIS = { fontSize: 11, fill: '#64748b' };
const GRID = '#eef2f7';

const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function ChartTooltip({ active, payload, label, money }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-700">{shortDate(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="size-2.5 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.name}</span>
          <span className="ml-auto pl-3 font-semibold text-slate-800">{money ? formatINR(p.value) : formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
      {items.map(([key, label, total]) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: SERIES[key] }} />
          {label} <b className="text-slate-800">{total}</b>
        </span>
      ))}
    </div>
  );
}

const isEmpty = (series, keys) => !series?.length || series.every((d) => keys.every((k) => !d[k]));

/** Daily referral funnel: clicks, leads and paid registrations on one count axis, or net revenue */
export function PerformanceChart({ series, loading, height = 280 }) {
  const [view, setView] = useState('funnel');
  if (loading) return <Skeleton className="h-72 w-full" />;
  const sum = (k) => (series || []).reduce((s, d) => s + (d[k] || 0), 0);

  return (
    <div>
      <Tabs value={view} onChange={setView} tabs={[{ value: 'funnel', label: 'Traffic & registrations' }, { value: 'revenue', label: 'Revenue' }]} />
      {view === 'funnel' ? (
        isEmpty(series, ['clicks', 'leads', 'paid']) ? (
          <EmptyState icon={BarChart3} title="No activity in this period" description="Clicks and registrations will appear here as soon as people use your referral links." />
        ) : (
          <>
            <Legend items={[['clicks', 'Clicks', formatNumber(sum('clicks'))], ['leads', 'Leads', formatNumber(sum('leads'))], ['paid', 'Paid', formatNumber(sum('paid'))]]} />
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                {['clicks', 'leads', 'paid'].map((k) => (
                  <Line key={k} type="monotone" dataKey={k} name={k} stroke={SERIES[k]} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        )
      ) : isEmpty(series, ['revenue']) ? (
        <EmptyState icon={BarChart3} title="No revenue in this period" description="Verified payments will appear here." />
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-600">Net revenue <b className="text-slate-800">{formatINR(sum('revenue'))}</b></p>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => formatINR(v, { compact: true })} width={56} />
              <Tooltip content={<ChartTooltip money />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="revenue" name="revenue" fill={SERIES.revenue} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

/** Traffic by UTM source - single measure, horizontal bars, labelled values */
export function SourcesChart({ data, loading }) {
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!data?.length) return <EmptyState icon={BarChart3} title="No traffic yet" description="Share your link with UTM tags to see where clicks come from." />;
  const max = Math.max(...data.map((d) => d.clicks));
  return (
    <ul className="space-y-3" aria-label="Clicks by source">
      {data.map((d) => (
        <li key={d.source} className="text-sm">
          <div className="mb-1 flex justify-between text-slate-600">
            <span className="capitalize">{d.source}</span>
            <span className="font-semibold text-slate-800">{formatNumber(d.clicks)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(4, (d.clicks / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Ranked bar list (top influencers / workshops) */
export function RankedBars({ data, valueKey, labelKey, format = formatNumber, loading }) {
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!data?.length) return <EmptyState icon={BarChart3} title="No data yet" />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 8, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey={labelKey} tick={AXIS} axisLine={false} tickLine={false} width={110} />
        <Tooltip formatter={(v) => format(v)} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey={valueKey} radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fontSize: 11, fill: '#334155', formatter: format }}>
          {data.map((d, i) => (
            <Cell key={i} fill={SERIES.paid} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
