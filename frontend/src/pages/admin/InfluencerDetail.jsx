import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Pencil, KeyRound, Trash2, MousePointerClick, Users, BadgeCheck, IndianRupee, Wallet, CheckCircle2, Percent, ClipboardCheck, Undo2, Instagram,
} from 'lucide-react';
import { Button, Card, CopyButton, DataTable, EmptyState, ErrorState, Modal, Pagination, SearchInput, Skeleton, StatusBadge, Tabs, useConfirm, FilterBar } from '../../components/ui';
import { SourcesChart } from '../../dashboards/Charts';
import { MiniStat, PerformanceLegend, PerformanceOverview, TrendCard } from '../../dashboards/Widgets';
import InfluencerForm from './InfluencerForm';
import LeadDetail from './LeadDetail';
import CommissionRateEditor from './CommissionRateEditor';
import { ExportButtons, FilterSelect, statusOptions, useWorkshopOptions } from './shared';
import { useDocumentTitle, useFetch, useListQuery } from '../../hooks';
import { post, del, errorMessage } from '../../services/api';
import { formatDate, formatDateTime, formatINR, formatNumber, titleCase } from '../../utils/format';
import { viewRangeLabel } from '../../utils/audience';

export default function InfluencerDetail() {
  const { id } = useParams();
  const inf = useFetch(`/influencers/${id}`);
  const perf = useFetch(`/influencers/${id}/performance`, { days: 30 });
  const [tab, setTab] = useState('leads');
  const lq = useListQuery({ filters: { workshopId: '', paymentStatus: '', attendanceStatus: '' } });
  const eq = useListQuery({ filters: { status: '' } });
  const pq = useListQuery();
  const leads = useFetch(`/influencers/${id}/leads`, lq.params, { enabled: tab === 'leads' });
  const earnings = useFetch(`/influencers/${id}/earnings`, eq.params, { enabled: tab === 'earnings' });
  const payouts = useFetch('/payouts', { ...pq.params, influencerId: id }, { enabled: tab === 'payouts' });
  const workshopOptions = useWorkshopOptions();
  const [editOpen, setEditOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);
  const [leadId, setLeadId] = useState(null);
  const { ask, dialog } = useConfirm();
  const navigate = useNavigate();
  useDocumentTitle(inf.data?.user?.name || 'Influencer');

  if (inf.error) return <div className="card"><ErrorState message={inf.error} onRetry={inf.reload} /></div>;
  if (!inf.data) return <Skeleton className="h-96 rounded-2xl" />;
  const d = inf.data;
  const s = perf.data?.summary;
  const pd = d.payoutDetails || {};

  const removeInfluencer = () =>
    ask({
      title: `Delete ${d.user?.name}?`,
      message: `This permanently deletes the account (${d.influencerCode}), login and referral link. Past leads stay, marked as direct. If they earned commission, deleting is blocked. Deactivate them instead.`,
      confirmLabel: 'Delete influencer',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await del(`/influencers/${id}`);
          toast.success(`${d.user?.name} deleted`);
          navigate('/admin/influencers', { replace: true });
        } catch (err) {
          toast.error(errorMessage(err), { duration: 7000 });
          throw err;
        }
      },
    });

  const resetPassword = () =>
    ask({
      title: 'Reset password?',
      message: `A new temporary password will be generated and emailed to ${d.user?.email}. Existing sessions are logged out.`,
      confirmLabel: 'Reset password',
      onConfirm: async () => {
        try {
          const res = await post(`/influencers/${id}/reset-password`);
          setTempPassword(res.data.tempPassword);
        } catch (err) {
          toast.error(errorMessage(err));
          throw err;
        }
      },
    });

  return (
    <>
      <Link to="/admin/influencers" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy"><ArrowLeft className="size-4" /> All influencers</Link>

      {/* Profile header */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {d.profileImage ? <img src={d.profileImage} alt="" className="size-16 rounded-full object-cover ring-4 ring-brand/10" /> : <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-brand to-purple text-xl font-bold text-white">{d.user?.name?.[0]}</span>}
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-extrabold">{d.user?.name} <StatusBadge status={d.status} /></h1>
            <p className="text-sm text-slate-500">{d.influencerCode} · {d.user?.email}{d.user?.phone ? ` · ${d.user.phone}` : ''}</p>
            {d.instagramUsername && <a className="mt-0.5 inline-flex items-center gap-1 text-sm text-brand hover:underline" href={`https://instagram.com/${d.instagramUsername}`} target="_blank" rel="noreferrer"><Instagram className="size-3.5" />@{d.instagramUsername}</a>}
            {d.audience?.avgViews && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {d.audience.followers ? <span className="rounded-full bg-purple-50 px-2 py-0.5 font-medium text-purple">{formatNumber(d.audience.followers)}+ followers</span> : null}
                {[['IG Reels', d.audience.avgViews.instagram], ['YouTube', d.audience.avgViews.youtube], ['Facebook', d.audience.avgViews.facebook]]
                  .filter(([, v]) => v !== null && v !== undefined)
                  .map(([k, v]) => <span key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{k}: <b className="text-navy">{viewRangeLabel(v)}</b> avg views</span>)}
                {d.audience.youtubeChannel && <a href={d.audience.youtubeChannel} target="_blank" rel="noreferrer" className="rounded-full bg-red-50 px-2 py-0.5 text-red-600 hover:underline">YouTube channel</a>}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-2 flex items-center gap-1 rounded-xl bg-brand-50/70 py-1 pl-3 pr-1 ring-1 ring-brand/15">
            <span className="text-xs font-medium text-slate-500">Commission</span>
            <CommissionRateEditor size="lg" influencer={{ ...d, stats: { commissionPending: s?.commission.pending } }} onSaved={() => { inf.reload(); perf.reload(); }} />
          </div>
          <ExportButtons url="/reports/leads" params={{ influencerId: id }} name={`leads-${d.influencerCode}`} />
          <Button variant="secondary" icon={KeyRound} onClick={resetPassword}>Reset password</Button>
          <Button variant="secondary" icon={Trash2} onClick={removeInfluencer} className="hover:!border-rose-200 hover:!text-rose-600">Delete</Button>
          <Button icon={Pencil} onClick={() => setEditOpen(true)}>Edit</Button>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <TrendCard label="Total Clicks" value={formatNumber(s?.clicks)} icon={MousePointerClick} tint="blue" loading={perf.loading} />
        <TrendCard label="Registrations" value={formatNumber(s?.registrations)} icon={ClipboardCheck} tint="indigo" loading={perf.loading} />
        <TrendCard label="Paid Registrations" value={formatNumber(s?.paidRegistrations)} icon={BadgeCheck} tint="green" loading={perf.loading} />
        <TrendCard label="Revenue Generated" value={formatINR(s?.revenue)} icon={IndianRupee} tint="purple" loading={perf.loading} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="Leads" value={formatNumber(s?.leads)} loading={perf.loading} />
        <MiniStat label="Click → lead" value={`${s?.clickToLeadRate ?? 0}%`} loading={perf.loading} />
        <MiniStat label="Lead → paid" value={`${s?.conversionRate ?? 0}%`} loading={perf.loading} />
        <MiniStat label="Attended" value={formatNumber(s?.attended)} loading={perf.loading} />
        <MiniStat label="Commission payable" value={formatINR(s?.commission.payable)} loading={perf.loading} />
        <MiniStat label="Commission paid" value={formatINR(s?.commission.paid)} loading={perf.loading} />
      </div>
      {s?.refunded > 0 && <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Undo2 className="size-4" /> {formatINR(s.refunded)} refunded · {formatINR(s.commission.reversed)} commission reversed{s.commission.clawbackOutstanding ? ` · ${formatINR(s.commission.clawbackOutstanding)} clawback` : ''}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Performance (last 30 days)" className="lg:col-span-2" actions={<PerformanceLegend />}>
          <PerformanceOverview series={perf.data?.series} loading={perf.loading} />
        </Card>
        <Card title="Traffic sources"><SourcesChart data={perf.data?.sources} loading={perf.loading} /></Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Performance by workshop" className="lg:col-span-2" bodyClassName="p-0">
          <DataTable
            rowKey="workshopId"
            loading={perf.loading}
            rows={perf.data?.workshops}
            columns={[
              { key: 'title', header: 'Workshop', render: (r) => <div><p className="max-w-[240px] truncate font-medium text-navy">{r.title}</p><p className="text-xs text-slate-400">{formatDate(r.startDate)}</p></div> },
              { key: 'leads', header: 'Leads', render: (r) => formatNumber(r.leads) },
              { key: 'paid', header: 'Paid', render: (r) => formatNumber(r.paid) },
              { key: 'conversionRate', header: 'Conversion', render: (r) => `${r.conversionRate}%` },
              { key: 'attended', header: 'Attended', render: (r) => `${formatNumber(r.attended)}${r.paid ? ` (${r.attendanceRate}%)` : ''}` },
              { key: 'revenue', header: 'Revenue', render: (r) => formatINR(r.revenue) },
            ]}
            empty={<EmptyState icon={Percent} title="No registrations yet" />}
          />
        </Card>
        <div className="space-y-6">
          <Card title="Referral setup">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-slate-500">Referral URL</dt><dd className="flex items-center justify-between gap-2 font-medium text-navy"><span className="truncate">{d.referralUrl}</span><CopyButton text={d.referralUrl} label="" /></dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-500">Commission rate</dt><dd><CommissionRateEditor influencer={{ ...d, stats: { commissionPending: s?.commission.pending } }} onSaved={() => { inf.reload(); perf.reload(); }} /></dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Joined</dt><dd className="font-medium">{formatDate(d.createdAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Last login</dt><dd className="font-medium">{formatDateTime(d.user?.lastLoginAt)}</dd></div>
            </dl>
          </Card>
          <Card title="Payout details">
            {pd.isComplete ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Method</dt><dd className="font-medium">{pd.method === 'upi' ? 'UPI' : 'Bank transfer'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Name</dt><dd className="font-medium">{pd.accountHolderName}</dd></div>
                {pd.method === 'upi' ? (
                  <div className="flex justify-between gap-2"><dt className="text-slate-500">UPI ID</dt><dd className="flex items-center gap-1 font-mono font-medium">{pd.upiId}<CopyButton text={pd.upiId || ''} label="" /></dd></div>
                ) : (
                  <>
                    <div className="flex justify-between"><dt className="text-slate-500">Bank</dt><dd className="font-medium">{pd.bankName || '—'}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-slate-500">Account</dt><dd className="flex items-center gap-1 font-mono font-medium">{pd.accountNumber}<CopyButton text={pd.accountNumber || ''} label="" /></dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">IFSC</dt><dd className="font-mono font-medium">{pd.ifsc}</dd></div>
                  </>
                )}
                {pd.pan && <div className="flex justify-between"><dt className="text-slate-500">PAN</dt><dd className="font-mono font-medium">{pd.pan}</dd></div>}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Not added yet.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Leads / earnings / payouts */}
      <div className="mt-6">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'leads', label: `Leads${s ? ` (${s.leads})` : ''}` }, { value: 'earnings', label: 'Commissions' }, { value: 'payouts', label: 'Payouts' }]} />
        <Card bodyClassName="p-0">
          {tab === 'leads' && (
            <>
              <FilterBar className="sm:grid-cols-2 lg:grid-cols-4" active={Object.entries(lq.filters).filter(([k, v]) => v && k !== 'scope').length} search={<SearchInput value={lq.search} onChange={lq.setSearch} placeholder="Name, email or phone" />}>
                <FilterSelect value={lq.filters.workshopId} onChange={(v) => lq.setFilter('workshopId', v)} placeholder="All workshops" options={workshopOptions} />
                <FilterSelect value={lq.filters.paymentStatus} onChange={(v) => lq.setFilter('paymentStatus', v)} placeholder="Any payment" options={statusOptions(['pending', 'paid', 'failed', 'refunded', 'partially_refunded'])} />
                <FilterSelect value={lq.filters.attendanceStatus} onChange={(v) => lq.setFilter('attendanceStatus', v)} placeholder="Any attendance" options={statusOptions(['pending', 'attended', 'absent'])} />
              </FilterBar>
              <DataTable
                rows={leads.data}
                loading={leads.loading}
                error={leads.error}
                sort={lq.sort}
                onSort={lq.toggleSort}
                columns={[
                  { key: 'name', header: 'Lead', sortable: true, render: (r) => <button type="button" onClick={() => setLeadId(r._id)} className="text-left"><p className="font-medium text-navy hover:text-brand">{r.name}</p><p className="text-xs text-slate-400">{r.email}</p></button> },
                  { key: 'phone', header: 'Phone', render: (r) => r.phone },
                  { key: 'city', header: 'City', render: (r) => r.city || '—' },
                  { key: 'createdAt', header: 'Registered', sortable: true, render: (r) => formatDate(r.createdAt) },
                  { key: 'workshop', header: 'Workshop', render: (r) => <span className="block max-w-[160px] truncate">{r.workshop?.title}</span> },
                  { key: 'utm', header: 'Source', render: (r) => <span className="text-xs text-slate-500">{[r.utmSource, r.utmCampaign].filter(Boolean).join(' / ') || titleCase(r.attributionMethod || '')}</span> },
                  { key: 'paymentStatus', header: 'Payment', sortable: true, render: (r) => <StatusBadge status={r.paymentStatus} /> },
                  { key: 'attendanceStatus', header: 'Attendance', render: (r) => <StatusBadge status={r.attendanceStatus} /> },
                  { key: 'commissionStatus', header: 'Commission', render: (r) => (r.commissionAmount ? <span className="flex items-center gap-1.5"><StatusBadge status={r.commissionStatus} /><span className="text-xs">{formatINR(r.commissionAmount)}</span></span> : <span className="text-slate-400">—</span>) },
                  { key: 'view', header: '', render: (r) => <Button size="sm" variant="ghost" onClick={() => setLeadId(r._id)}>Details</Button> },
                ]}
                empty={<EmptyState icon={Users} title="No leads match" />}
              />
              <Pagination meta={leads.meta} onPage={lq.setPage} />
            </>
          )}
          {tab === 'earnings' && (
            <>
              <div className="flex justify-end border-b border-slate-100 p-4">
                <FilterSelect className="sm:w-56" value={eq.filters.status} onChange={(v) => eq.setFilter('status', v)} placeholder="All statuses" options={statusOptions(['pending', 'approved', 'paid', 'rejected', 'reversed'])} />
              </div>
              <DataTable
                rows={earnings.data}
                loading={earnings.loading}
                error={earnings.error}
                columns={[
                  { key: 'createdAt', header: 'Date', render: (r) => formatDate(r.createdAt) },
                  { key: 'lead', header: 'Lead', render: (r) => <button type="button" className="text-left font-medium text-navy hover:text-brand" onClick={() => setLeadId(r.leadId?._id)}>{r.leadId?.name}</button> },
                  { key: 'workshop', header: 'Workshop', render: (r) => <span className="block max-w-[180px] truncate">{r.workshopId?.title}</span> },
                  { key: 'calc', header: 'Calculation', render: (r) => <span className="text-xs text-slate-500">{formatINR(r.eligibleNetRevenue)} × {r.commissionRate}%</span> },
                  { key: 'amount', header: 'Commission', render: (r) => <b className="text-navy">{formatINR(r.commissionAmount)}</b> },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                  { key: 'paidAt', header: 'Paid on', render: (r) => formatDate(r.paidAt) },
                ]}
                empty={<EmptyState icon={Wallet} title="No commissions yet" />}
              />
              <Pagination meta={earnings.meta} onPage={eq.setPage} />
            </>
          )}
          {tab === 'payouts' && (
            <>
              <DataTable
                rows={payouts.data}
                loading={payouts.loading}
                error={payouts.error}
                columns={[
                  { key: 'createdAt', header: 'Created', render: (r) => formatDate(r.createdAt) },
                  { key: 'amount', header: 'Amount', render: (r) => <b className="text-navy">{formatINR(r.amount)}</b> },
                  { key: 'n', header: 'Commissions', render: (r) => r.commissionIds?.length },
                  { key: 'method', header: 'Method', render: (r) => titleCase(r.paymentMethod) },
                  { key: 'txn', header: 'Transaction ID', render: (r) => <span className="font-mono text-xs">{r.transactionId || '—'}</span> },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                  { key: 'paidAt', header: 'Paid on', render: (r) => formatDate(r.paidAt) },
                ]}
                empty={<EmptyState icon={CheckCircle2} title="No payouts yet" action={<Link to="/admin/payouts" className="btn-secondary">Go to payouts</Link>} />}
              />
              <Pagination meta={payouts.meta} onPage={pq.setPage} />
            </>
          )}
        </Card>
      </div>

      <LeadDetail leadId={leadId} onClose={() => setLeadId(null)} />
      <InfluencerForm open={editOpen} influencer={d} onClose={() => setEditOpen(false)} onSaved={() => inf.reload()} />
      <Modal open={Boolean(tempPassword)} onClose={() => setTempPassword(null)} title="Password reset" size="sm" footer={<Button onClick={() => setTempPassword(null)}>Done</Button>}>
        <p className="text-sm text-slate-600">New temporary password (shown once, also emailed):</p>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-3 font-mono font-semibold">{tempPassword}<CopyButton text={tempPassword || ''} label="" /></div>
      </Modal>
      {dialog}
    </>
  );
}
