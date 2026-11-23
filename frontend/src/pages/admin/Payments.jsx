import { useState } from 'react';
import toast from 'react-hot-toast';
import { RotateCcw, CreditCard, AlertTriangle } from 'lucide-react';
import { Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Pagination, SearchInput, StatusBadge, Textarea, FilterBar } from '../../components/ui';
import { ExportButtons, FilterSelect, statusOptions, useInfluencerOptions, useWorkshopOptions } from './shared';
import { useDocumentTitle, useFetch, useListQuery } from '../../hooks';
import { post, errorMessage } from '../../services/api';
import { formatDateTime, formatINR, rupeesToPaise, titleCase } from '../../utils/format';

function RefundModal({ payment, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!payment) return null;
  const committed = (payment.refunds || []).filter((r) => r.status !== 'failed').reduce((s, r) => s + r.amount, 0);
  const refundable = payment.amount - committed;
  const submit = async () => {
    if (reason.trim().length < 3) return toast.error('Enter a reason');
    setBusy(true);
    try {
      await post(`/payments/${payment._id}/refund`, { amount: amount ? rupeesToPaise(amount) : undefined, reason });
      toast.success('Refund initiated');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Refund payment" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" loading={busy} onClick={submit}>Refund</Button></>}>
      <div className="space-y-4 text-sm">
        <p><b>{payment.leadId?.name}</b> paid {formatINR(payment.amount)} for {payment.workshopId?.title}. Refundable: <b>{formatINR(refundable)}</b>.</p>
        <Field label="Amount (₹)" hint="Leave blank for a full refund"><Input type="number" min="1" max={refundable / 100} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Reason" required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle className="size-4 shrink-0" /> The influencer's commission is adjusted automatically (a full refund reverses it and cancels the registration).</p>
      </div>
    </Modal>
  );
}

export default function AdminPayments() {
  useDocumentTitle('Payments');
  const q = useListQuery({ filters: { status: '', refundStatus: '', influencerId: '', workshopId: '', from: '', to: '' } });
  const { data, meta, loading, error, reload } = useFetch('/payments', q.params);
  const influencers = useInfluencerOptions();
  const workshops = useWorkshopOptions();
  const [refunding, setRefunding] = useState(null);

  const columns = [
    { key: 'createdAt', header: 'Date', sortable: true, render: (r) => formatDateTime(r.capturedAt || r.createdAt) },
    { key: 'customer', header: 'Customer', render: (r) => <div><p className="font-medium text-navy">{r.leadId?.name}</p><p className="text-xs text-slate-400">{r.leadId?.email}</p></div> },
    { key: 'workshop', header: 'Workshop', render: (r) => <span className="block max-w-[160px] truncate">{r.workshopId?.title}</span> },
    { key: 'influencer', header: 'Influencer', render: (r) => r.influencerId?.userId?.name || <span className="text-slate-400">Direct</span> },
    { key: 'amount', header: 'Amount', sortable: true, render: (r) => <b className="text-navy">{formatINR(r.amount)}</b> },
    { key: 'gateway', header: 'Gateway / Txn', render: (r) => <div className="text-xs"><p>{titleCase(r.gateway)}{r.method ? ` · ${r.method}` : ''}</p><p className="font-mono text-slate-400">{r.gatewayPaymentId || r.gatewayOrderId}</p></div> },
    { key: 'status', header: 'Status', render: (r) => <div className="space-y-1"><StatusBadge status={r.status} />{r.failureReason && <p className="max-w-[160px] truncate text-xs text-rose-600" title={r.failureReason}>{r.failureReason}</p>}</div> },
    { key: 'refundStatus', header: 'Refund', render: (r) => (r.refundStatus === 'none' ? <span className="text-slate-400">—</span> : <div><StatusBadge status={r.refundStatus} /><p className="text-xs text-slate-500">{formatINR(r.refundedAmount)}</p></div>) },
    { key: 'commission', header: 'Commission', render: (r) => (r.commission ? <div><p>{formatINR(r.commission.commissionAmount)} <span className="text-xs text-slate-400">@{r.commission.commissionRate}%</span></p><StatusBadge status={r.commission.status} /></div> : <span className="text-slate-400">—</span>) },
    { key: 'actions', header: '', render: (r) => (r.status === 'captured' && r.refundStatus !== 'full' ? <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setRefunding(r)}>Refund</Button> : null) },
  ];

  return (
    <>
      <PageHeader title="Payments" description="Verified by Razorpay signature and webhooks." actions={<ExportButtons url="/reports/payments" params={q.params} name="payments" />} />
      <Card bodyClassName="p-0">
        <FilterBar className="sm:grid-cols-2 lg:grid-cols-4" active={Object.entries(q.filters).filter(([k, v]) => v && k !== 'scope').length} search={<SearchInput value={q.search} onChange={q.setSearch} placeholder="Customer, order or payment ID" className="lg:col-span-2" />}>
          <FilterSelect value={q.filters.status} onChange={(v) => q.setFilter('status', v)} placeholder="Any status" options={statusOptions(['created', 'captured', 'failed'])} />
          <FilterSelect value={q.filters.refundStatus} onChange={(v) => q.setFilter('refundStatus', v)} placeholder="Any refund status" options={statusOptions(['none', 'pending', 'partial', 'full'])} />
          <FilterSelect value={q.filters.influencerId} onChange={(v) => q.setFilter('influencerId', v)} placeholder="All influencers" options={influencers} />
          <FilterSelect value={q.filters.workshopId} onChange={(v) => q.setFilter('workshopId', v)} placeholder="All workshops" options={workshops} />
          <Input type="date" value={q.filters.from} onChange={(e) => q.setFilter('from', e.target.value)} aria-label="From" />
          <Input type="date" value={q.filters.to} onChange={(e) => q.setFilter('to', e.target.value)} aria-label="To" />
        </FilterBar>
        <DataTable columns={columns} rows={data} loading={loading} error={error} onRetry={reload} sort={q.sort} onSort={q.toggleSort} empty={<EmptyState icon={CreditCard} title="No payments yet" />} />
        <Pagination meta={meta} onPage={q.setPage} />
      </Card>
      {refunding && <RefundModal key={refunding._id} payment={refunding} onClose={() => setRefunding(null)} onDone={reload} />}
    </>
  );
}
