import { useState } from 'react';
import { Wallet, Hourglass, BadgeCheck, CheckCircle2, Banknote } from 'lucide-react';
import { Card, DataTable, EmptyState, PageHeader, Pagination, Select, StatCard, StatusBadge, Tabs } from '../../components/ui';
import { useDocumentTitle, useFetch, useListQuery } from '../../hooks';
import { formatDate, formatINR, titleCase } from '../../utils/format';

export default function Earnings() {
  useDocumentTitle('My earnings');
  const [tab, setTab] = useState('commissions');
  const cq = useListQuery({ filters: { status: '' } });
  const pq = useListQuery();
  const commissions = useFetch('/influencers/me/earnings', cq.params);
  const payouts = useFetch('/influencers/me/payouts', pq.params, { enabled: tab === 'payouts' });
  const s = commissions.data?.summary;
  const loadingSummary = commissions.loading && !s;

  const cCols = [
    { key: 'createdAt', header: 'Date', sortable: true, render: (r) => formatDate(r.createdAt) },
    { key: 'lead', header: 'Lead', render: (r) => r.leadId?.name },
    { key: 'workshop', header: 'Workshop', render: (r) => <span className="block max-w-[200px] truncate">{r.workshopId?.title}</span> },
    { key: 'gross', header: 'Ticket', render: (r) => formatINR(r.grossAmount) },
    { key: 'eligible', header: 'Eligible revenue', render: (r) => formatINR(r.eligibleNetRevenue) },
    { key: 'rate', header: 'Rate', render: (r) => `${r.commissionRate}%` },
    { key: 'commissionAmount', header: 'Commission', sortable: true, render: (r) => <b className="text-navy">{formatINR(r.commissionAmount)}</b> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];
  const pCols = [
    { key: 'createdAt', header: 'Date', render: (r) => formatDate(r.paidAt || r.createdAt) },
    { key: 'amount', header: 'Amount', render: (r) => <b className="text-navy">{formatINR(r.amount)}</b> },
    { key: 'count', header: 'Commissions', render: (r) => r.commissionIds?.length },
    { key: 'paymentMethod', header: 'Method', render: (r) => titleCase(r.paymentMethod) },
    { key: 'transactionId', header: 'Transaction ID', render: (r) => <span className="font-mono text-xs">{r.transactionId || '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="My earnings" description="Commission is created after a verified payment and paid out once approved." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total commission" value={formatINR(s?.total)} icon={Wallet} tone="teal" loading={loadingSummary} />
        <StatCard label="Pending approval" value={formatINR(s?.pending)} icon={Hourglass} tone="amber" loading={loadingSummary} />
        <StatCard label="Approved (to be paid)" value={formatINR(s?.approved)} icon={BadgeCheck} tone="blue" loading={loadingSummary} />
        <StatCard label="Paid to you" value={formatINR(s?.paid)} icon={CheckCircle2} tone="green" loading={loadingSummary} />
      </div>
      {s?.clawbackOutstanding > 0 && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{formatINR(s.clawbackOutstanding)} from refunded registrations will be adjusted against future payouts.</p>
      )}

      <div className="mt-6">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'commissions', label: 'Commission history' }, { value: 'payouts', label: 'Payout history' }]} />
        {tab === 'commissions' ? (
          <Card bodyClassName="p-0">
            <div className="flex justify-end border-b border-slate-100 p-4">
              <Select className="sm:w-56" value={cq.filters.status} onChange={(e) => cq.setFilter('status', e.target.value)} placeholder="All statuses" options={['pending', 'approved', 'paid', 'rejected', 'reversed'].map((v) => ({ value: v, label: titleCase(v) }))} />
            </div>
            <DataTable
              columns={cCols}
              rows={commissions.data?.items}
              loading={commissions.loading}
              error={commissions.error}
              onRetry={commissions.reload}
              sort={cq.sort}
              onSort={cq.toggleSort}
              empty={<EmptyState icon={Wallet} title="No commissions yet" description="You earn commission on every paid registration from your links." />}
              mobileCard={(r) => (
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-medium text-navy">{r.leadId?.name}</p><p className="text-xs text-slate-500">{r.workshopId?.title} · {formatDate(r.createdAt)}</p></div>
                  <div className="text-right"><p className="font-bold text-navy">{formatINR(r.commissionAmount)}</p><StatusBadge status={r.status} /></div>
                </div>
              )}
            />
            <Pagination meta={commissions.meta} onPage={cq.setPage} />
          </Card>
        ) : (
          <Card bodyClassName="p-0">
            <DataTable columns={pCols} rows={payouts.data} loading={payouts.loading} error={payouts.error} onRetry={payouts.reload} empty={<EmptyState icon={Banknote} title="No payouts yet" description="Approved commissions are paid to the bank or UPI account in your profile." />} />
            <Pagination meta={payouts.meta} onPage={pq.setPage} />
          </Card>
        )}
      </div>
    </>
  );
}
