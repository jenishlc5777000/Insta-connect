import { Users } from 'lucide-react';
import { Card, DataTable, EmptyState, PageHeader, Pagination, SearchInput, Select, StatusBadge } from '../../components/ui';
import { useDocumentTitle, useFetch, useListQuery } from '../../hooks';
import { formatDate, formatINR } from '../../utils/format';

const opt = (arr) => arr.map((v) => ({ value: v, label: v.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) }));

export default function InfluencerLeads() {
  useDocumentTitle('My leads');
  const q = useListQuery({ filters: { workshopId: '', paymentStatus: '', attendanceStatus: '' } });
  const { data, meta, loading, error, reload } = useFetch('/influencers/me/leads', q.params);
  const workshops = useFetch('/influencers/me/workshops');

  const columns = [
    { key: 'name', header: 'Lead', sortable: true, render: (r) => <div><p className="font-medium text-navy">{r.name}</p><p className="text-xs text-slate-400">{r.city || r.email}</p></div> },
    { key: 'createdAt', header: 'Registered', sortable: true, render: (r) => formatDate(r.createdAt) },
    { key: 'workshop', header: 'Workshop', render: (r) => <span className="block max-w-[200px] truncate">{r.workshop?.title}</span> },
    { key: 'registrationStatus', header: 'Registration', render: (r) => <StatusBadge status={r.registrationStatus} /> },
    { key: 'paymentStatus', header: 'Payment', sortable: true, render: (r) => <StatusBadge status={r.paymentStatus} /> },
    { key: 'attendanceStatus', header: 'Attendance', render: (r) => <StatusBadge status={r.attendanceStatus} /> },
    { key: 'commissionStatus', header: 'Commission', render: (r) => (r.commissionStatus && r.commissionStatus !== 'not_eligible' ? <span className="flex items-center gap-2"><StatusBadge status={r.commissionStatus} /><span className="text-xs text-slate-500">{formatINR(r.commissionAmount)}</span></span> : <span className="text-xs text-slate-400">—</span>) },
  ];

  return (
    <>
      <PageHeader title="My leads" description="Everyone who registered through your links. Contact details are hidden for privacy." />
      <Card bodyClassName="p-0">
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-4">
          <SearchInput value={q.search} onChange={q.setSearch} placeholder="Search by name or city" className="sm:col-span-1" />
          <Select value={q.filters.workshopId} onChange={(e) => q.setFilter('workshopId', e.target.value)} placeholder="All workshops" options={(workshops.data || []).map((w) => ({ value: w._id, label: w.title }))} />
          <Select value={q.filters.paymentStatus} onChange={(e) => q.setFilter('paymentStatus', e.target.value)} placeholder="Any payment status" options={opt(['pending', 'paid', 'failed', 'refunded', 'partially_refunded'])} />
          <Select value={q.filters.attendanceStatus} onChange={(e) => q.setFilter('attendanceStatus', e.target.value)} placeholder="Any attendance" options={opt(['pending', 'attended', 'absent'])} />
        </div>
        <DataTable
          columns={columns}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={q.sort}
          onSort={q.toggleSort}
          empty={<EmptyState icon={Users} title="No leads found" description="Leads appear here when someone registers through your referral link." />}
          mobileCard={(r) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-medium text-navy">{r.name}</p><p className="text-xs text-slate-500">{r.workshop?.title} · {formatDate(r.createdAt)}</p></div>
                <StatusBadge status={r.paymentStatus} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs"><StatusBadge status={r.registrationStatus} /><StatusBadge status={r.attendanceStatus} />{r.commissionStatus && r.commissionStatus !== 'not_eligible' && <StatusBadge status={r.commissionStatus} label={`Commission ${formatINR(r.commissionAmount)}`} />}</div>
            </div>
          )}
        />
        <Pagination meta={meta} onPage={q.setPage} />
      </Card>
    </>
  );
}
