import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Pencil, Shuffle, Megaphone, CheckCheck, X as XIcon, Eye, Trash2 } from 'lucide-react';
import LeadDetail from './LeadDetail';
import { Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Textarea, useConfirm } from '../../components/ui';
import { ExportButtons, FilterSelect, statusOptions, useInfluencerOptions, useWorkshopOptions } from './shared';
import { useDocumentTitle, useFetch, useListQuery } from '../../hooks';
import { get, patch, post, errorMessage, applyFieldErrors } from '../../services/api';
import { formatDate, formatDateTime, titleCase } from '../../utils/format';

function EditLeadModal({ lead, onClose, onSaved }) {
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm();
  useEffect(() => {
    if (lead) reset({ name: lead.name, email: lead.email, phone: lead.phone, city: lead.city || '', mode: lead.mode || '', registrationStatus: lead.registrationStatus, attendanceStatus: lead.attendanceStatus, notes: lead.notes || '' });
  }, [lead, reset]);
  const onSubmit = async (v) => {
    try {
      await patch(`/leads/${lead._id}`, { ...v, mode: v.mode || undefined, city: v.city || undefined, notes: v.notes || undefined });
      toast.success('Lead updated');
      onSaved();
      onClose();
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err));
    }
  };
  return (
    <Modal open={Boolean(lead)} onClose={onClose} title="Edit lead" size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Save</Button></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Name" error={errors.name?.message}><Input {...register('name')} error={errors.name} /></Field>
        <Field label="Email" error={errors.email?.message}><Input type="email" {...register('email')} error={errors.email} /></Field>
        <Field label="Phone" error={errors.phone?.message}><Input {...register('phone')} error={errors.phone} /></Field>
        <Field label="City"><Input {...register('city')} /></Field>
        <Field label="Mode"><Select {...register('mode')} placeholder="—" options={statusOptions(['online', 'offline'])} /></Field>
        <Field label="Registration"><Select {...register('registrationStatus')} options={statusOptions(['registered', 'confirmed', 'cancelled'])} /></Field>
        <Field label="Attendance"><Select {...register('attendanceStatus')} options={statusOptions(['pending', 'attended', 'absent'])} /></Field>
        <Field label="Internal notes" className="sm:col-span-2"><Textarea rows={3} {...register('notes')} /></Field>
      </form>
    </Modal>
  );
}

function AttributionModal({ lead, influencers, onClose, onSaved }) {
  const [influencerId, setInfluencerId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (!lead) return;
    setInfluencerId(lead.influencer?._id || '');
    setReason('');
    get(`/leads/${lead._id}`).then((r) => setHistory(r.data.history.filter((h) => h.action === 'lead.reassign_attribution'))).catch(() => setHistory([]));
  }, [lead]);
  const save = async () => {
    if (reason.trim().length < 5) return toast.error('Please give a reason (min 5 characters)');
    setBusy(true);
    try {
      await patch(`/leads/${lead._id}/attribution`, { influencerId: influencerId || null, reason });
      toast.success('Attribution updated and logged');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={Boolean(lead)} onClose={onClose} title="Change referral attribution" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Reassign</Button></>}>
      {lead && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600"><b>{lead.name}</b> is currently attributed to <b>{lead.influencer ? `${lead.influencer.name} (${lead.influencer.influencerCode})` : 'no influencer'}</b> via {titleCase(lead.attributionMethod || 'none')}.</p>
          <Field label="New influencer"><Select value={influencerId} onChange={(e) => setInfluencerId(e.target.value)} placeholder="No influencer (direct)" options={influencers} /></Field>
          <Field label="Reason (saved to the audit log)" required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <p className="text-xs text-slate-500">Unpaid commissions move to the new influencer at their rate. Leads whose commission was already paid out cannot be re-attributed.</p>
          {history.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Previous changes</p>
              <ul className="space-y-1 text-xs text-slate-600">{history.map((h) => <li key={h._id}>{formatDateTime(h.createdAt)} — {h.adminId?.name}: {h.reason}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function AdminLeads() {
  useDocumentTitle('Leads');
  const q = useListQuery({ filters: { influencerId: '', workshopId: '', paymentStatus: '', attendanceStatus: '', from: '', to: '' } });
  const { data, meta, loading, error, reload } = useFetch('/leads', q.params);
  const influencers = useInfluencerOptions();
  const workshops = useWorkshopOptions();
  const [editing, setEditing] = useState(null);
  const [attributing, setAttributing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [selected, setSelected] = useState([]);

  useEffect(() => setSelected([]), [data]);

  const { ask, dialog } = useConfirm();

  const removeLeads = (ids, label) =>
    ask({
      title: ids.length === 1 ? `Delete ${label}?` : `Delete ${ids.length} leads?`,
      message: 'This permanently removes the registration and any unpaid order. Leads with a successful payment are kept. Refund them first if you need to remove them.',
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        try {
          const res = await post('/leads/delete', { leadIds: ids });
          const { deleted, blocked } = res.data;
          if (deleted) toast.success(`${deleted} lead${deleted > 1 ? 's' : ''} deleted`);
          if (blocked.length) toast.error(blocked.length === 1 ? `Not deleted: ${blocked[0].reason}` : `${blocked.length} not deleted (successful payments must be refunded first)`, { duration: 6000 });
          setSelected([]);
          reload();
        } catch (err) {
          toast.error(errorMessage(err));
          throw err;
        }
      },
    });

  const bulkAttendance = async (attendanceStatus) => {
    try {
      const res = await post('/leads/attendance/bulk', { leadIds: selected, attendanceStatus });
      toast.success(`${res.data.updated} lead(s) marked ${attendanceStatus}`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const columns = [
    { key: 'name', header: 'Lead', sortable: true, render: (r) => <button type="button" onClick={() => setViewing(r._id)} className="text-left"><p className="font-medium text-navy hover:text-brand">{r.name}</p><p className="text-xs text-slate-400">{r.email} · {r.phone}</p></button> },
    { key: 'createdAt', header: 'Registered', sortable: true, render: (r) => formatDate(r.createdAt) },
    { key: 'workshop', header: 'Workshop', render: (r) => <span className="block max-w-[180px] truncate">{r.workshop?.title}</span> },
    { key: 'influencer', header: 'Influencer', render: (r) => (r.influencer ? <div><p>{r.influencer.name}</p><p className="text-xs text-slate-400">{r.influencer.influencerCode} · {titleCase(r.attributionMethod)}</p></div> : <span className="text-slate-400">Direct</span>) },
    { key: 'utm', header: 'UTM', render: (r) => <span className="text-xs text-slate-500">{[r.utmSource, r.utmMedium, r.utmCampaign].filter(Boolean).join(' / ') || '—'}</span> },
    { key: 'paymentStatus', header: 'Payment', sortable: true, render: (r) => <StatusBadge status={r.paymentStatus} /> },
    { key: 'attendanceStatus', header: 'Attendance', sortable: true, render: (r) => <StatusBadge status={r.attendanceStatus} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewing(r._id)} aria-label="View details" title="View all details" />
        <Button size="sm" variant="ghost" icon={Shuffle} onClick={() => setAttributing(r)} aria-label="Change attribution" title="Change attribution" />
        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(r)} aria-label="Edit" />
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => removeLeads([r._id], r.name)} aria-label="Delete" title="Delete lead" className="hover:!text-rose-600" />
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Leads" description="All workshop registrations with referral attribution." actions={<ExportButtons url="/leads/export" params={q.params} name="leads" />} />
      <Card bodyClassName="p-0">
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={q.search} onChange={q.setSearch} placeholder="Name, email or phone" className="lg:col-span-2" />
          <FilterSelect value={q.filters.influencerId} onChange={(v) => q.setFilter('influencerId', v)} placeholder="All influencers" options={[{ value: 'none', label: 'Direct (no influencer)' }, ...influencers]} />
          <FilterSelect value={q.filters.workshopId} onChange={(v) => q.setFilter('workshopId', v)} placeholder="All workshops" options={workshops} />
          <FilterSelect value={q.filters.paymentStatus} onChange={(v) => q.setFilter('paymentStatus', v)} placeholder="Any payment" options={statusOptions(['pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'not_required'])} />
          <FilterSelect value={q.filters.attendanceStatus} onChange={(v) => q.setFilter('attendanceStatus', v)} placeholder="Any attendance" options={statusOptions(['pending', 'attended', 'absent'])} />
          <Input type="date" value={q.filters.from} onChange={(e) => q.setFilter('from', e.target.value)} aria-label="From date" />
          <Input type="date" value={q.filters.to} onChange={(e) => q.setFilter('to', e.target.value)} aria-label="To date" />
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-brand-50/50 px-4 py-2.5 text-sm">
            <span className="font-medium text-navy">{selected.length} selected</span>
            <Button size="sm" variant="secondary" icon={CheckCheck} onClick={() => bulkAttendance('attended')}>Mark attended</Button>
            <Button size="sm" variant="secondary" icon={XIcon} onClick={() => bulkAttendance('absent')}>Mark absent</Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => removeLeads(selected)} className="sm:ml-auto">Delete selected</Button>
          </div>
        )}
        <DataTable
          columns={columns}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={q.sort}
          onSort={q.toggleSort}
          selectable
          selected={selected}
          onSelect={setSelected}
          empty={<EmptyState icon={Megaphone} title="No leads match these filters" />}
        />
        <Pagination meta={meta} onPage={q.setPage} />
      </Card>
      <EditLeadModal lead={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <LeadDetail leadId={viewing} onClose={() => setViewing(null)} />
      <AttributionModal lead={attributing} influencers={influencers} onClose={() => setAttributing(null)} onSaved={reload} />
      {dialog}
    </>
  );
}
