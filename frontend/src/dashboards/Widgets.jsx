import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { ArrowDownRight, ArrowUpRight, BarChart3, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cx, EmptyState, Skeleton } from '../components/ui';
import { formatNumber } from '../utils/format';

/* ------------------------------ Trend stat card ----------------------------- */
const TINTS = {
  blue: { card: 'bg-[#eef3ff] border-[#dbe5ff]', icon: 'bg-brand text-white shadow-brand/30' },
  indigo: { card: 'bg-[#eff1ff] border-[#dfe3ff]', icon: 'bg-indigo-500 text-white shadow-indigo-500/30' },
  green: { card: 'bg-[#e9f8f2] border-[#d2f0e3]', icon: 'bg-emerald-500 text-white shadow-emerald-500/30' },
  purple: { card: 'bg-[#f3efff] border-[#e6deff]', icon: 'bg-purple text-white shadow-purple/30' },
  teal: { card: 'bg-[#e6f7f5] border-[#cdeee9]', icon: 'bg-teal text-white shadow-teal/30' },
  amber: { card: 'bg-[#fff6e8] border-[#ffe8c2]', icon: 'bg-amber-500 text-white shadow-amber-500/30' },
};

export function TrendBadge({ value, period = '30d' }) {
  if (value === undefined) return null;
  if (value === null) return <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand">New</span>;
  const up = value > 0;
  const flat = value === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      title={`vs previous ${period}`}
      className={cx('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold', flat ? 'bg-slate-100 text-slate-500' : up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}
    >
      <Icon className="size-3.5" />
      {Math.abs(value)}%
    </span>
  );
}

/** `to` makes the card a link (e.g. to a filtered leads list); `hint` is a small caption under the value */
export function TrendCard({ label, value, sub, icon: Icon, tint = 'blue', trend, loading, period, to, hint }) {
  const t = TINTS[tint];
  const Wrapper = to ? Link : 'div';
  return (
    <Wrapper to={to} className={cx('block rounded-2xl border p-4 sm:p-5', t.card, to && 'transition hover:-translate-y-0.5 hover:shadow-md')}>
      <div className="flex items-start justify-between gap-2">
        <span className={cx('grid size-10 place-items-center rounded-xl shadow-lg', t.icon)}>
          <Icon className="size-5" />
        </span>
        {!loading && <TrendBadge value={trend} period={period} />}
      </div>
      <p className="mt-3 text-sm font-medium text-slate-600">{label}</p>
      {loading ? (
        <Skeleton className="mt-1.5 h-8 w-24" />
      ) : (
        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="font-display text-2xl font-extrabold text-navy sm:text-[1.7rem]">{value}</span>
          {sub && <span className="text-xs font-medium text-slate-500">{sub}</span>}
        </p>
      )}
      {hint && !loading && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Wrapper>
  );
}

/** Small secondary metric used under the hero cards */
export function MiniStat({ label, value, loading }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
      <p className="truncate text-xs text-slate-500">{label}</p>
      {loading ? <Skeleton className="mt-1 h-5 w-16" /> : <p className="truncate text-base font-bold text-navy">{value}</p>}
    </div>
  );
}

/* ---------------------------- Performance overview -------------------------- */
const C_CLICKS = '#2F6BFF';
const C_REG = '#0A9F90';
const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function PerfTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-700">{shortDate(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="size-2.5 rounded-full" style={{ background: p.color }} />
          {p.name}
          <span className="ml-auto pl-4 font-semibold text-slate-800">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function PerformanceOverview({ series, loading, height = 260 }) {
  if (loading) return <Skeleton className="h-64 w-full" />;
  const empty = !series?.length || series.every((d) => !d.clicks && !d.leads);
  if (empty) return <EmptyState icon={BarChart3} title="No activity yet" description="Clicks and registrations appear here as soon as your links are used." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="g-clicks" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C_CLICKS} stopOpacity=".28" />
            <stop offset="1" stopColor={C_CLICKS} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="g-reg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C_REG} stopOpacity=".22" />
            <stop offset="1" stopColor={C_REG} stopOpacity="0" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip content={<PerfTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
        <Area type="monotone" dataKey="clicks" name="Clicks" stroke={C_CLICKS} strokeWidth={2.2} fill="url(#g-clicks)" dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
        <Area type="monotone" dataKey="leads" name="Registrations" stroke={C_REG} strokeWidth={2.2} fill="url(#g-reg)" dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PerformanceLegend() {
  return (
    <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: C_CLICKS }} />Clicks</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: C_REG }} />Registrations</span>
    </div>
  );
}

/* ---------------------------------- Donut ----------------------------------- */
// Fixed categorical order (validated palette), then neutrals for Others / Direct
const DONUT = ['#2F6BFF', '#0A9F90', '#6E4FE8', '#E8890C'];
const colorFor = (item, i) => (item.key === 'others' ? '#94a3b8' : item.key === 'direct' ? '#cbd5e1' : DONUT[i % DONUT.length]);

export function RegistrationsDonut({ data, loading }) {
  if (loading) return <Skeleton className="h-56 w-full" />;
  if (!data?.total) return <EmptyState icon={BarChart3} title="No registrations yet" />;
  const items = data.items.map((it, i) => ({ ...it, color: colorFor(it, i) }));
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative size-48 shrink-0">
        <PieChart width={192} height={192}>
          <Pie data={items} dataKey="count" nameKey="name" cx={96} cy={96} innerRadius={62} outerRadius={94} paddingAngle={items.length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2} startAngle={90} endAngle={-270} isAnimationActive={false}>
            {items.map((it) => <Cell key={it.key} fill={it.color} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${formatNumber(v)} registrations`, n]} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-2xl font-extrabold text-navy">{formatNumber(data.total)}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-2.5">
        {items.map((it) => (
          <li key={it.key} className="flex items-center gap-3 text-sm">
            <span className="size-3 shrink-0 rounded-full" style={{ background: it.color }} />
            <span className="min-w-0 flex-1 truncate text-slate-700">{it.name}</span>
            <span className="text-xs text-slate-400">{formatNumber(it.count)}</span>
            <span className="w-12 text-right font-semibold text-navy">{it.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
