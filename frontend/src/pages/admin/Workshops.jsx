import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, ExternalLink, GraduationCap, Star } from 'lucide-react';
import { Button, Card, DataTable, EmptyState, PageHeader, Pagination, SearchInput, StatusBadge, useConfirm } from '../../components/ui';
import { FilterSelect, statusOptions } from './shared';
import { useDocumentTitle, useFetch, useListQuery } from '../../hooks';
import { del, errorMessage } from '../../services/api';
import { effectivePrice, formatDateTime, formatINR, titleCase } from '../../utils/format';

export default function AdminWorkshops() {
  useDocumentTitle('Workshops');
  const q = useListQuery({ filters: { status: '', scope: 'admin' } });
  const { data, meta, loading, error, reload } = useFetch('/workshops', q.params);
  const { ask, dialog } = useConfirm();

  const remove = (w) =>
    ask({
      title: `Delete "${w.title}"?`,
      message: 'Workshops with registrations cannot be deleted — set them to cancelled instead.',
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await del(`/workshops/${w._id}`);
          toast.success('Workshop deleted');
          reload();
        } catch (err) {
          toast.error(errorMessage(err));
          throw err;
        }
      },
    });

  const columns = [
    { key: 'title', header: 'Workshop', sortable: true, render: (r) => <div><p className="flex items-center gap-1.5 font-medium text-navy">{r.featured && <Star className="size-3.5 fill-amber-400 text-amber-400" />}<span className="max-w-[260px] truncate">{r.title}</span></p><p className="text-xs text-slate-400">{r.campaignCode} · /{r.slug}</p></div> },
    { key: 'startDate', header: 'Starts', sortable: true, render: (r) => formatDateTime(r.startDate) },
    { key: 'mode', header: 'Mode', render: (r) => titleCase(r.mode) },
    { key: 'price', header: 'Price', sortable: true, render: (r) => <span>{formatINR(effectivePrice(r))}{effectivePrice(r) < r.price && <span className="ml-1 text-xs text-slate-400 line-through">{formatINR(r.price)}</span>}</span> },
    { key: 'commission', header: 'Commission', render: (r) => (r.commissionRate === null || r.commissionRate === undefined ? <span className="text-slate-400">Default</span> : `${r.commissionRate}%`) },
    { key: 'seats', header: 'Seats', render: (r) => (r.capacity ? `${r.seatsTaken} / ${r.capacity}` : `${r.seatsTaken} / ∞`) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1">
        <a href={`/workshops/${r.slug}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" aria-label="Preview"><ExternalLink className="size-4" /></a>
        <Link to={`/admin/workshops/${r._id}/edit`} className="btn-ghost btn-sm" aria-label="Edit"><Pencil className="size-4" /></Link>
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(r)} aria-label="Delete" />
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Workshops" description="Create campaigns, set pricing, seats and commission." actions={<Link to="/admin/workshops/new" className="btn-primary"><Plus className="size-4" /> New workshop</Link>} />
      <Card bodyClassName="p-0">
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
          <SearchInput value={q.search} onChange={q.setSearch} placeholder="Search workshops" className="sm:col-span-2" />
          <FilterSelect value={q.filters.status} onChange={(v) => q.setFilter('status', v)} placeholder="All statuses" options={statusOptions(['draft', 'published', 'completed', 'cancelled'])} />
        </div>
        <DataTable
          columns={columns}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={q.sort}
          onSort={q.toggleSort}
          empty={<EmptyState icon={GraduationCap} title="No workshops yet" action={<Link to="/admin/workshops/new" className="btn-primary">Create a workshop</Link>} />}
          mobileCard={(r) => (
            <Link to={`/admin/workshops/${r._id}/edit`} className="flex items-start justify-between gap-3">
              <div><p className="font-medium text-navy">{r.title}</p><p className="text-xs text-slate-500">{formatDateTime(r.startDate)} · {formatINR(effectivePrice(r))}</p></div>
              <StatusBadge status={r.status} />
            </Link>
          )}
        />
        <Pagination meta={meta} onPage={q.setPage} />
      </Card>
      {dialog}
    </>
  );
}
