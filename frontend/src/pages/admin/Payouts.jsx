import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Banknote, CheckCircle2, XCircle, Send, AlertTriangle } from 'lucide-react';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Pagination, Select, StatusBadge, Textarea } from '../../components/ui';
import { ExportButtons, FilterSelect, statusOptions, useInfluencerOptions } from './shared';
import { useDocumentTitle, useFetch, useListQuery } from '../../hooks';
import { patch, post, errorMessage } from '../../services/api';
import { formatDate, formatINR, titleCase } from '../../utils/format';

const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

function CreatePayoutModal({ row, onClose, onDone }) {
  const [form, setForm] = useState({ paymentMethod: row?.payoutMethod === 'bank' ? 'bank_transfer' : 'upi', transactionId: '', notes: '', markPaid: true });
  const [busy, setBusy] = useState(false);
  if (!row) return null;
  const submit = async () => {
    if (form.markPaid && form.transactionId.trim().length < 2) return toast.error('Enter the transaction / UTR ID');
    setBusy(true);
    try {
      await post('/payouts', { influencerId: row.influencerId, commissionIds: row.commissionIds, paymentMethod: form.paymentMethod, transactionId: form.transactionId || undefined, notes: form.notes || undefined, markPaid: form.markPaid });
      toast.success(form.markPaid ? 'Payout recorded as paid' : 'Payout created');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Pay ${row.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>{form.markPaid ? 'Record payment' : 'Create pending payout'}</Button></>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-slate-500">{row.count} approved commission(s)</p>
          <p className="font-display text-3xl font-bold text-navy">{formatINR(row.amount)}</p>
          {row.clawbackOutstanding > 0 && <p className="mt-1 text-xs text-rose-600">Note: {formatINR(row.clawbackOutstanding)} clawback outstanding from refunded paid commissions — deduct manually if applicable.</p>}
        </div>
        {!row.payoutReady && <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle className="size-4 shrink-0" /> This influencer hasn't added payout details yet. <Link to={`/admin/influencers/${row.influencerId}`} className="underline">View profile</Link></p>}
        <Field label="Payment method"><Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} options={METHODS} /></Field>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-brand" checked={form.markPaid} onChange={(e) => setForm({ ...form, markPaid: e.target.checked })} /> I've already transferred the money — mark as paid</label>
        <Field label={`Transaction / UTR ID${form.markPaid ? ' *' : ''}`}><Input value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} /></Field>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function ResolveModal({ state, onClose, onDone }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const paid = state.action === 'paid';
  const submit = async () => {
    if (value.trim().length < (paid ? 2 : 3)) return toast.error(paid ? 'Enter the transaction ID' : 'Enter a reason');
    setBusy(true);
    try {
      if (paid) await patch(`/payouts/${state.payout._id}/mark-paid`, { transactionId: value });
      else await patch(`/payouts/${state.payout._id}/fail`, { notes: value });
      toast.success(paid ? 'Payout marked as paid' : 'Payout marked as failed; commissions released');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={paid ? 'Mark payout as paid' : 'Mark payout as failed'} size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={paid ? 'primary' : 'danger'} loading={busy} onClick={submit}>Confirm</Button></>}>
      <Field label={paid ? 'Transaction / UTR ID' : 'What went wrong?'} required>{paid ? <Input value={value} onChange={(e) => setValue(e.target.value)} /> : <Textarea rows={2} value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
    </Modal>
  );
}

export default function AdminPayouts() {
  useDocumentTitle('Payouts');
  const eligible = useFetch('/payouts/eligible');
  const q = useListQuery({ filters: { status: '', influencerId: '' } });
  const history = useFetch('/payouts', q.params);
  const influencers = useInfluencerOptions();
  const [paying, setPaying] = useState(null);
  const [resolving, setResolving] = useState(null);
  const refresh = () => {
    eligible.reload();
    history.reload();
  };

  return (
    <>
      <PageHeader title="Payouts" description="Pay approved commissions and record transaction IDs." actions={<ExportButtons url="/reports/payouts" params={q.params} name="payouts" />} />

      <Card title="Ready to pay" bodyClassName="p-0" className="mb-6">
        <DataTable
          rowKey="influencerId"
          rows={eligible.data}
          loading={eligible.loading}
          error={eligible.error}
          onRetry={eligible.reload}
          columns={[
            { key: 'name', header: 'Influencer', render: (r) => <div><p className="font-medium text-navy">{r.name}</p><p className="text-xs text-slate-400">{r.influencerCode} · {r.email}</p></div> },
            { key: 'count', header: 'Commissions', render: (r) => r.count },
            { key: 'amount', header: 'Amount', render: (r) => <b className="text-navy">{formatINR(r.amount)}</b> },
            { key: 'method', header: 'Payout details', render: (r) => (r.payoutReady ? <Badge tone="green">{r.payoutMethod === 'bank' ? 'Bank' : 'UPI'} on file</Badge> : <Badge tone="amber">Missing</Badge>) },
            { key: 'actions', header: '', render: (r) => <div className="flex justify-end"><Button size="sm" icon={Send} onClick={() => setPaying(r)}>Pay out</Button></div> },
          ]}
          empty={<EmptyState icon={Banknote} title="Nothing to pay right now" description="Approve pending commissions to add them to the payout queue." action={<Link to="/admin/commissions" className="btn-secondary">Review commissions</Link>} />}
        />
      </Card>

      <Card title="Payout history" bodyClassName="p-0">
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
          <FilterSelect value={q.filters.status} onChange={(v) => q.setFilter('status', v)} placeholder="Any status" options={statusOptions(['pending', 'paid', 'failed'])} />
          <FilterSelect value={q.filters.influencerId} onChange={(v) => q.setFilter('influencerId', v)} placeholder="All influencers" options={influencers} />
        </div>
        <DataTable
          rows={history.data}
          loading={history.loading}
          error={history.error}
          onRetry={history.reload}
          sort={q.sort}
          onSort={q.toggleSort}
          columns={[
            { key: 'createdAt', header: 'Created', sortable: true, render: (r) => formatDate(r.createdAt) },
            { key: 'influencer', header: 'Influencer', render: (r) => r.influencerId?.userId?.name },
            { key: 'amount', header: 'Amount', sortable: true, render: (r) => <b className="text-navy">{formatINR(r.amount)}</b> },
            { key: 'n', header: 'Commissions', render: (r) => r.commissionIds?.length },
            { key: 'paymentMethod', header: 'Method', render: (r) => titleCase(r.paymentMethod) },
            { key: 'transactionId', header: 'Transaction ID', render: (r) => <span className="font-mono text-xs">{r.transactionId || '—'}</span> },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'paidAt', header: 'Paid on', sortable: true, render: (r) => formatDate(r.paidAt) },
            { key: 'actions', header: '', render: (r) => (r.status === 'pending' ? <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" icon={CheckCircle2} onClick={() => setResolving({ payout: r, action: 'paid' })}>Paid</Button><Button size="sm" variant="ghost" icon={XCircle} onClick={() => setResolving({ payout: r, action: 'failed' })}>Failed</Button></div> : null) },
          ]}
          empty={<EmptyState icon={Banknote} title="No payouts yet" />}
        />
        <Pagination meta={history.meta} onPage={q.setPage} />
      </Card>

      {paying && <CreatePayoutModal key={paying.influencerId} row={paying} onClose={() => setPaying(null)} onDone={refresh} />}
      {resolving && <ResolveModal key={resolving.payout._id + resolving.action} state={resolving} onClose={() => setResolving(null)} onDone={refresh} />}
    </>
  );
}
