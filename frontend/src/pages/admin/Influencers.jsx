import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Pencil, Power, Users, ExternalLink, Trash2 } from 'lucide-react';
import { Button, Card, DataTable, EmptyState, PageHeader, Pagination, SearchInput, StatusBadge, useConfirm, FilterBar } from '../../components/ui';
import InfluencerForm from './InfluencerForm';
import CommissionRateEditor from './CommissionRateEditor';
import { FilterSelect, ExportButtons, statusOptions } from './shared';
import { useDocumentTitle, useFetch, useListQuery } from '../../hooks';
import { patch, del, errorMessage } from '../../services/api';
import { formatINR, formatNumber } from '../../utils/format';

export default function Influencers() {
  useDocumentTitle('Influencers');
  const [params, setParams] = useSearchParams();
  const q = useListQuery({ sort: '-createdAt', filters: { status: '' } });
  const { data, meta, loading, error, reload } = useFetch('/influencers', q.params);
  const [form, setForm] = useState({ open: false, influencer: null });
  const { ask, dialog } = useConfirm();

  useEffect(() => {
    if (params.get('new')) {
      setForm({ open: true, influencer: null });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const removeInfluencer = (inf) =>
    ask({
      title: `Delete ${inf.user?.name}?`,
      message: `This permanently deletes ${inf.user?.name}'s account (${inf.influencerCode}), login and referral link ${inf.subdomain}. Their past leads stay, marked as direct. Influencers who earned commission cannot be deleted. Deactivate them instead.`,
      confirmLabel: 'Delete influencer',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await del(`/influencers/${inf._id}`);
          toast.success(`${inf.user?.name} deleted`);
          reload();
        } catch (err) {
          toast.error(errorMessage(err), { duration: 7000 });
          throw err;
        }
      },
    });

  const toggleStatus = (inf) => {
    const next = inf.status === 'active' ? 'inactive' : 'active';
    ask({
      title: `${next === 'active' ? 'Activate' : 'Deactivate'} ${inf.user?.name}?`,
      message: next === 'inactive' ? 'They will be logged out, their subdomain stops attributing new referrals, and they cannot log in.' : 'Their dashboard and referral subdomain will work again.',
      confirmLabel: next === 'active' ? 'Activate' : 'Deactivate',
      tone: next === 'inactive' ? 'danger' : 'primary',
      onConfirm: async () => {
        try {
          await patch(`/influencers/${inf._id}/status`, { status: next });
          toast.success(`Influencer ${next === 'active' ? 'activated' : 'deactivated'}`);
          reload();
        } catch (err) {
          toast.error(errorMessage(err));
          throw err;
        }
      },
    });
  };

  const columns = [
    { key: 'influencerCode', header: 'Influencer', sortable: true, render: (r) => (
      <Link to={`/admin/influencers/${r._id}`} className="flex items-center gap-3">
        {r.profileImage ? <img src={r.profileImage} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full gradient-brand text-sm font-bold text-white">{r.user?.name?.[0]}</span>}
        <div><p className="font-medium text-navy hover:text-brand">{r.user?.name}</p><p className="text-xs text-slate-400">{r.influencerCode} · {r.user?.email}</p></div>
      </Link>
    ) },
    { key: 'subdomain', header: 'Subdomain', sortable: true, render: (r) => <a href={r.referralUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">{r.subdomain}<ExternalLink className="size-3" /></a> },
    { key: 'rate', header: 'Commission %', render: (r) => <CommissionRateEditor influencer={r} onSaved={reload} /> },
    { key: 'clicks', header: 'Clicks', render: (r) => formatNumber(r.stats.clicks) },
    { key: 'leads', header: 'Leads', render: (r) => formatNumber(r.stats.leads) },
    { key: 'paid', header: 'Paid', render: (r) => formatNumber(r.stats.paid) },
    { key: 'revenue', header: 'Revenue', render: (r) => formatINR(r.stats.revenue) },
    { key: 'commission', header: 'Payable / Paid', render: (r) => <span>{formatINR(r.stats.commissionPending)} <span className="text-slate-400">/ {formatINR(r.stats.commissionPaid)}</span></span> },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setForm({ open: true, influencer: r })} aria-label="Edit" />
        <Button size="sm" variant="ghost" icon={Power} onClick={() => toggleStatus(r)} aria-label="Toggle status" />
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => removeInfluencer(r)} aria-label="Delete" title="Delete influencer" className="hover:!text-rose-600" />
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Influencers"
        description="Create partners, assign subdomains and set commission rates."
        actions={<><ExportButtons url="/reports/influencers" params={{}} name="influencers" /><Button icon={Plus} onClick={() => setForm({ open: true, influencer: null })}>Add influencer</Button></>}
      />
      <Card bodyClassName="p-0">
        <FilterBar className="sm:grid-cols-3" active={Object.entries(q.filters).filter(([k, v]) => v && k !== 'scope').length} search={<SearchInput value={q.search} onChange={q.setSearch} placeholder="Name, email, code or subdomain" className="sm:col-span-2" />}>
          <FilterSelect value={q.filters.status} onChange={(v) => q.setFilter('status', v)} placeholder="All statuses" options={statusOptions(['active', 'inactive'])} />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={q.sort}
          onSort={q.toggleSort}
          empty={<EmptyState icon={Users} title="No influencers found" action={<Button icon={Plus} onClick={() => setForm({ open: true, influencer: null })}>Add your first influencer</Button>} />}
          mobileCard={(r) => (
            <div className="flex items-start justify-between gap-3">
              <Link to={`/admin/influencers/${r._id}`}><p className="font-medium text-navy">{r.user?.name}</p><p className="text-xs text-slate-500">{r.influencerCode} · {r.subdomain}</p><p className="mt-1 text-xs text-slate-500">{r.stats.leads} leads · {r.stats.paid} paid · {formatINR(r.stats.revenue)}</p></Link>
              <div className="flex flex-col items-end gap-2"><StatusBadge status={r.status} /><Button size="sm" variant="secondary" icon={Pencil} onClick={() => setForm({ open: true, influencer: r })}>Edit</Button></div>
            </div>
          )}
        />
        <Pagination meta={meta} onPage={q.setPage} />
      </Card>
      <InfluencerForm open={form.open} influencer={form.influencer} onClose={() => setForm({ open: false, influencer: null })} onSaved={reload} />
      {dialog}
    </>
  );
}
