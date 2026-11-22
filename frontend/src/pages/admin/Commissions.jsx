import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, X, BadgePercent, Hourglass, BadgeCheck, CheckCircle2, Undo2 } from 'lucide-react';
import { Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Pagination, StatCard, StatusBadge, Textarea } from '../../components/ui';
import { ExportButtons, FilterSelect, statusOptions, useInfluencerOptions, useWorkshopOptions } from './shared';
import { useDocumentTitle, useFetch, useListQuery } from '../../hooks';
import { patch, post, errorMessage } from '../../services/api';
import { formatDate, formatINR } from '../../utils/format';

export default function AdminCommissions() {
  useDocumentTitle('Commissions');
  const q = useListQuery({ filters: { status: 'pending', influencerId: '', workshopId: '', from: '', to: '' } });
  const { data, meta, loading, error, reload } = useFetch('/commissions', q.params);
  const summary = useFetch('/commissions/summary', { influencerId: q.filters.influencerId || undefined, workshopId: q.filters.workshopId || undefined });
  const influencers = useInfluencerOptions();
  const workshops = useWorkshopOptions();
  const [selected, setSelected] = useState([]);
  const [rejecting, setRejecting] = useState(null); // array of ids
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setSelected([]), [data]);
  const refresh = () => {
    reload();
    summary.reload();
  };

  const approve = async (ids) => {
    setBusy(true);
    try {
      if (ids.length === 1) await patch(`/commissions/${ids[0]}/approve`);
      else await post('/commissions/bulk', { ids, action: 'approve' });
      toast.success(`${ids.length} commission(s) approved`);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (reason.trim().length < 3) return toast.error('Enter a reason');
    setBusy(true);
    try {
      if (rejecting.length === 1) await patch(`/commissions/${rejecting[0]}/reject`, { reason });
      else await post('/commissions/bulk', { ids: rejecting, action: 'reject', reason });
      toast.success('Rejected');
      setRejecting(null);
      setReason('');
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const s = summary.data;
  const columns = [
    { key: 'createdAt', header: 'Date', sortable: true, render: (r) => formatDate(r.createdAt) },
    { key: 'influencer', header: 'Influencer', render: (r) => <div><p className="font-medium text-navy">{r.influencerId?.userId?.name}</p><p className="text-xs text-slate-400">{r.influencerId?.influencerCode}</p></div> },
    { key: 'lead', header: 'Lead / Workshop', render: (r) => <div><p>{r.leadId?.name}</p><p className="max-w-[180px] truncate text-xs text-slate-400">{r.workshopId?.title}</p></div> },
    { key: 'calc', header: 'Calculation', render: (r) => <div className="text-xs text-slate-500"><p>Gross {formatINR(r.grossAmount)}</p><p>Eligible {formatINR(r.eligibleNetRevenue)} × {r.commissionRate}%</p></div> },
    { key: 'commissionAmount', header: 'Commission', sortable: true, render: (r) => <div><b className="text-navy">{formatINR(r.commissionAmount)}</b>{r.clawbackAmount > 0 && <p className="flex items-center gap-1 text-xs text-rose-600"><Undo2 className="size-3" /> clawback {formatINR(r.clawbackAmount)}</p>}</div> },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <div><StatusBadge status={r.status} />{(r.rejectionReason || r.reversalReason) && <p className="mt-1 max-w-[160px] truncate text-xs text-slate-400" title={r.rejectionReason || r.reversalReason}>{r.rejectionReason || r.reversalReason}</p>}</div> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1">
        {r.status === 'pending' && <Button size="sm" variant="ghost" icon={Check} onClick={() => approve([r._id])} disabled={busy}>Approve</Button>}
        {['pending', 'approved'].includes(r.status) && !r.payoutId && <Button size="sm" variant="ghost" icon={X} onClick={() => setRejecting([r._id])}>Reject</Button>}
      </div>
    ) },
  ];

  const pendingSelected = (data || []).filter((c) => selected.includes(c._id) && c.status === 'pending').map((c) => c._id);

  return (
    <>
      <PageHeader title="Commissions" description="Created automatically after verified payments. Approve before paying out." actions={<ExportButtons url="/reports/commissions" params={q.params} name="commissions" />} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Pending approval" value={formatINR(s?.pending)} icon={Hourglass} tone="amber" loading={summary.loading} />
        <StatCard label="Approved (payable)" value={formatINR(s?.approved)} icon={BadgeCheck} tone="blue" loading={summary.loading} />
        <StatCard label="Paid" value={formatINR(s?.paid)} icon={CheckCircle2} tone="green" loading={summary.loading} />
        <StatCard label="Reversed / rejected" value={formatINR((s?.reversed || 0) + (s?.rejected || 0))} icon={Undo2} tone="purple" hint={s?.clawbackOutstanding ? `${formatINR(s.clawbackOutstanding)} clawback` : undefined} loading={summary.loading} />
      </div>
      <Card bodyClassName="p-0">
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect value={q.filters.status} onChange={(v) => q.setFilter('status', v)} placeholder="All statuses" options={statusOptions(['pending', 'approved', 'paid', 'rejected', 'reversed'])} />
          <FilterSelect value={q.filters.influencerId} onChange={(v) => q.setFilter('influencerId', v)} placeholder="All influencers" options={influencers} />
          <FilterSelect value={q.filters.workshopId} onChange={(v) => q.setFilter('workshopId', v)} placeholder="All campaigns" options={workshops} />
          <Input type="date" value={q.filters.from} onChange={(e) => q.setFilter('from', e.target.value)} aria-label="From" />
          <Input type="date" value={q.filters.to} onChange={(e) => q.setFilter('to', e.target.value)} aria-label="To" />
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-brand-50/50 px-4 py-2.5 text-sm">
            <span className="font-medium text-navy">{selected.length} selected</span>
            <Button size="sm" icon={Check} disabled={!pendingSelected.length || busy} onClick={() => approve(pendingSelected)}>Approve {pendingSelected.length}</Button>
            <Button size="sm" variant="secondary" icon={X} onClick={() => setRejecting(selected)}>Reject</Button>
          </div>
        )}
        <DataTable columns={columns} rows={data} loading={loading} error={error} onRetry={reload} sort={q.sort} onSort={q.toggleSort} selectable selected={selected} onSelect={setSelected} empty={<EmptyState icon={BadgePercent} title="No commissions match these filters" />} />
        <Pagination meta={meta} onPage={q.setPage} />
      </Card>

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title={`Reject ${rejecting?.length || 0} commission(s)`} size="sm" footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={reject}>Reject</Button></>}>
        <Field label="Reason (visible in the audit log)" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </>
  );
}
