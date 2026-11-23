import { useState } from 'react';
import { BarChart3, Users, GraduationCap, Percent, IndianRupee, BadgePercent, CalendarCheck, MousePointerClick, Megaphone, Banknote, CreditCard } from 'lucide-react';
import { Card, DataTable, EmptyState, Input, PageHeader, cx, FilterBar } from '../../components/ui';
import { ExportButtons, FilterSelect, useInfluencerOptions, useWorkshopOptions } from './shared';
import { useDocumentTitle, useFetch } from '../../hooks';

const REPORTS = [
  { type: 'influencers', label: 'Influencer performance', icon: Users, filters: [] },
  { type: 'workshops', label: 'Workshop performance', icon: GraduationCap, filters: [] },
  { type: 'conversion', label: 'Registration conversion', icon: Percent, filters: [] },
  { type: 'revenue', label: 'Revenue (daily)', icon: IndianRupee, filters: ['date', 'influencer', 'workshop'] },
  { type: 'commissions', label: 'Commission', icon: BadgePercent, filters: ['date', 'influencer', 'workshop'] },
  { type: 'attendance', label: 'Attendance', icon: CalendarCheck, filters: ['workshop'] },
  { type: 'traffic', label: 'Referral traffic', icon: MousePointerClick, filters: ['date', 'influencer'] },
  { type: 'leads', label: 'All leads', icon: Megaphone, filters: ['date', 'influencer', 'workshop'] },
  { type: 'payments', label: 'Payments', icon: CreditCard, filters: ['date', 'influencer', 'workshop'] },
  { type: 'payouts', label: 'Payouts', icon: Banknote, filters: ['date', 'influencer'] },
];

export default function Reports() {
  useDocumentTitle('Reports');
  const [type, setType] = useState('influencers');
  const [filters, setFilters] = useState({ from: '', to: '', influencerId: '', workshopId: '' });
  const report = REPORTS.find((r) => r.type === type);
  const params = Object.fromEntries(Object.entries(filters).filter(([k, v]) => v && ((k === 'from' || k === 'to') ? report.filters.includes('date') : report.filters.includes(k.replace('Id', '')))));
  const { data, meta, loading, error, reload } = useFetch(`/reports/${type}`, { ...params, format: 'json', limit: 200 });
  const influencers = useInfluencerOptions();
  const workshops = useWorkshopOptions();
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const columns = (data?.columns || []).map((c) => ({ key: c.key, header: c.header, render: (r) => (r[c.key] === null || r[c.key] === undefined || r[c.key] === '' ? '—' : String(r[c.key])) }));
  const rows = (data?.rows || []).map((r, i) => ({ ...r, __key: i }));

  return (
    <>
      <PageHeader title="Reports & analytics" description="Preview any report and export it to CSV or Excel." actions={<ExportButtons url={`/reports/${type}`} params={params} name={type} />} />
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {REPORTS.map(({ type: t, label, icon: Icon }) => (
          <button key={t} type="button" onClick={() => setType(t)} className={cx('flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-medium transition', type === t ? 'border-brand bg-brand-50 text-brand' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
            <Icon className="size-4 shrink-0" /> {label}
          </button>
        ))}
      </div>
      <Card title={report.label} bodyClassName="p-0">
        {report.filters.length > 0 && (
          <FilterBar className="sm:grid-cols-4" active={Object.keys(params).length}>
            {report.filters.includes('date') && (
              <>
                <Input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} aria-label="From" />
                <Input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} aria-label="To" />
              </>
            )}
            {report.filters.includes('influencer') && <FilterSelect value={filters.influencerId} onChange={(v) => set('influencerId', v)} placeholder="All influencers" options={influencers} />}
            {report.filters.includes('workshop') && <FilterSelect value={filters.workshopId} onChange={(v) => set('workshopId', v)} placeholder="All workshops" options={workshops} />}
          </FilterBar>
        )}
        <DataTable rowKey="__key" columns={columns} rows={rows} loading={loading} error={error} onRetry={reload} empty={<EmptyState icon={BarChart3} title="No data for this report yet" />} />
        {meta?.truncated && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Showing the first {rows.length} of {meta.total} rows. Export to see everything.</p>}
      </Card>
    </>
  );
}
