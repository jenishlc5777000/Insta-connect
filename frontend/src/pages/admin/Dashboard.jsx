import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ClipboardCheck, IndianRupee, Scale, CreditCard, UserPlus, BadgeCheck, Plus, Clock } from 'lucide-react';
import { Card, DataTable, EmptyState, ErrorState, Select, StatusBadge } from '../../components/ui';
import { SourcesChart } from '../../dashboards/Charts';
import { MiniStat, PerformanceLegend, PerformanceOverview, RegistrationsDonut, TrendCard } from '../../dashboards/Widgets';
import { useDocumentTitle, useFetch } from '../../hooks';
import { formatDate, formatINR, formatNumber, timeAgo } from '../../utils/format';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
];

const ACTIVITY = {
  payment: { icon: CreditCard, cls: 'bg-emerald-50 text-emerald-600', text: (a) => <>Payment received from <b>{a.name}</b></> },
  lead: { icon: UserPlus, cls: 'bg-brand-50 text-brand', text: (a) => <>New registration{a.influencer ? <> via <b>{a.influencer}</b></> : ''}: <b>{a.name}</b></> },
  commission: { icon: BadgeCheck, cls: 'bg-amber-50 text-amber-600', text: (a) => <>Commission approved for <b>{a.name}</b></> },
};

export default function AdminDashboard() {
  useDocumentTitle('Admin dashboard');
  const [range, setRange] = useState('30');
  const params = useMemo(() => {
    if (range === 'all') return { days: 90 };
    const from = new Date(Date.now() - Number(range) * 864e5).toISOString().slice(0, 10);
    return { from, days: Number(range) };
  }, [range]);
  const { data, loading, error, reload } = useFetch('/analytics/admin/overview', params);
  const s = data?.summary;
  const t = range === 'all' ? undefined : data?.trends;
  const period = range === 'all' ? '' : `${range}d`;

  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-[1.7rem]">Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Manage your influencer campaigns and workshops</p>
        </div>
        <div className="flex gap-2">
          <Select className="sm:w-48" value={range} onChange={(e) => setRange(e.target.value)} options={RANGES} />
          <Link to="/admin/influencers?new=1" className="btn-primary whitespace-nowrap"><Plus className="size-4" /> Influencer</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <TrendCard label="Successful Registrations" value={formatNumber(s?.successfulRegistrations)} icon={BadgeCheck} tint="green" trend={t?.successful} period={period} loading={loading} hint="Paid · seat confirmed" to="/admin/leads?paymentStatus=paid" />
        <TrendCard label="Pending Payment" value={formatNumber(s?.pendingPaymentRegistrations)} icon={Clock} tint="amber" loading={loading} hint="Signed up, not paid yet" to="/admin/leads?paymentStatus=pending" />
        <TrendCard label="Total Revenue" value={formatINR(s?.revenue)} icon={IndianRupee} tint="green" trend={t?.revenue} period={period} loading={loading} />
        <TrendCard label="Commission Payable" value={formatINR(s?.commission.payable)} icon={Scale} tint="purple" trend={t?.payable} period={period} loading={loading} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat label="Referral clicks" value={formatNumber(s?.clicks)} loading={loading} />
        <MiniStat label="Total leads" value={formatNumber(s?.leads)} loading={loading} />
        <MiniStat label="Active influencers" value={`${formatNumber(s?.activeInfluencers)} of ${formatNumber(s?.totalInfluencers)}`} loading={loading} />
        <MiniStat label="Commission paid" value={formatINR(s?.commission.paid)} loading={loading} />
        <MiniStat label="Upcoming workshops" value={formatNumber(s?.upcomingWorkshops)} loading={loading} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Registrations by Influencer">
          <RegistrationsDonut data={data?.byInfluencer} loading={loading} />
        </Card>
        <Card title="Recent Activities" bodyClassName="p-0" actions={<Link to="/admin/leads" className="text-sm font-medium text-brand">View All</Link>}>
          {!loading && !data?.activity?.length ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data?.activity?.slice(0, 7).map((a, i) => {
                const cfg = ACTIVITY[a.type];
                const Icon = cfg.icon;
                return (
                  <li key={i} className="flex items-center gap-3 px-5 py-3">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full ${cfg.cls}`}><Icon className="size-4" /></span>
                    <p className="min-w-0 flex-1 truncate text-sm text-slate-600">{cfg.text(a)}</p>
                    <div className="shrink-0 text-right">
                      {a.amount ? <p className="text-sm font-semibold text-navy">{formatINR(a.amount)}</p> : null}
                      <p className="text-xs text-slate-400">{timeAgo(a.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Performance Overview" className="lg:col-span-2" actions={<PerformanceLegend />}>
          <PerformanceOverview series={data?.series} loading={loading} />
        </Card>
        <Card title="Traffic sources"><SourcesChart data={data?.sources} loading={loading} /></Card>
      </div>

      <Card title="Workshop performance" className="mt-6" bodyClassName="p-0" actions={<Link to="/admin/reports" className="text-sm font-medium text-brand">Reports</Link>}>
        <DataTable
          loading={loading}
          rowKey="workshopId"
          rows={data?.workshops}
          columns={[
            { key: 'title', header: 'Workshop', render: (r) => <div><p className="max-w-[260px] truncate font-medium text-navy">{r.title}</p><p className="text-xs text-slate-400">{formatDate(r.startDate)}</p></div> },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'leads', header: 'Leads', render: (r) => formatNumber(r.leads) },
            { key: 'paid', header: 'Paid', render: (r) => formatNumber(r.paid) },
            { key: 'conversionRate', header: 'Conversion', render: (r) => `${r.conversionRate}%` },
            { key: 'attended', header: 'Attended', render: (r) => formatNumber(r.attended) },
            { key: 'revenue', header: 'Revenue', render: (r) => formatINR(r.revenue) },
          ]}
          empty={<EmptyState title="No workshops yet" action={<Link to="/admin/workshops/new" className="btn-primary">Create workshop</Link>} />}
        />
      </Card>
    </>
  );
}
